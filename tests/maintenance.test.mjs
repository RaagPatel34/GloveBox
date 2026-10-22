import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoGarage, isGarage, makeProposals, sampleCommand, addProposals, resolveProposal } from '../src/lib/maintenance.ts';
import { itemStatus, estimateOdometer } from '../src/lib/intervals.ts';
const now = new Date('2026-10-22T12:00:00Z');
test('sample command requires approval, preserves mileage and survives serialization', () => {
  const garage = demoGarage(now);
  const result = sampleCommand('I drove 300 miles on dirt roads', garage, now);
  assert.equal(result.proposals.length, 2);
  const next = addProposals(garage, result.proposals);
  assert.deepEqual(next.items, garage.items);
  const applied = resolveProposal(next, result.proposals[0].id, 'applied');
  assert.equal(applied.vehicle.odometer, 48000);
  assert.equal(applied.items.find(i => i.id === 'cabin_filter').dueAt, '2026-10-24T12:00:00.000Z');
  assert.equal(applied.items.find(i => i.id === 'cabin_filter').lastDoneAt, undefined);
  assert.equal(isGarage(JSON.parse(JSON.stringify(applied))), true);
  assert.deepEqual(resolveProposal(applied, result.proposals[0].id, 'applied'), applied);
});
test('dismiss changes no due dates and stale advice cannot overwrite a schedule', () => {
  const garage = demoGarage(now);
  const [proposal] = sampleCommand('dirt roads', garage, now).proposals;
  const next = addProposals(garage, [proposal]);
  assert.deepEqual(resolveProposal(next, proposal.id, 'dismissed').items, garage.items);
  const changed = { ...next, items: next.items.map(i => i.id === proposal.itemId ? { ...i, dueAt: now.toISOString() } : i) };
  assert.throws(() => resolveProposal(changed, proposal.id, 'applied'), /schedule changed/);
});
test('validates model tool arguments and never postpones overdue maintenance', () => {
  const garage = demoGarage(now);
  for (const bad of [null, [{ itemId: 'oil', daysUntilDue: 2, reason: 'replace' }], [{ itemId: 'cabin_filter', daysUntilDue: -1, reason: 'check' }], [{ itemId: 'cabin_filter', daysUntilDue: 30, reason: 'check' }]]) assert.throws(() => makeProposals(bad, garage, 'super', now));
  assert.deepEqual(makeProposals([{ itemId: 'wash', daysUntilDue: 2, reason: 'wash' }], garage, 'super', now), []);
});
test('unknown history is distinct from on track and deadlines use either threshold', () => {
  assert.equal(itemStatus({}, now, 48000), 'unknown');
  assert.equal(itemStatus({ dueOdometer: 48000 }, now, 48000), 'due_soon');
  assert.equal(itemStatus({ dueAt: '2027-01-01', dueOdometer: 47999 }, now, 48000), 'overdue');
  assert.equal(estimateOdometer({ odometer: 48000, weeklyMiles: 250 }, now, new Date('2026-10-29T12:00:00Z')), 48250);
});
test('bad saved data is rejected and unsupported sample commands generate no advice', () => {
  const garage = demoGarage(now);
  assert.equal(isGarage({ ...garage, items: [{ id: '__proto__' }] }), false);
  assert.equal(isGarage({ ...garage, vehicle: { ...garage.vehicle, odometer: -1 } }), false);
  assert.equal(isGarage({ ...garage, items: [...garage.items, garage.items[0]] }), false);
  assert.equal(sampleCommand('plan a trip', garage, now).proposals.length, 0);
});

test('issues #5 and #7: demo has eight cards with exactly the promised attention states', () => {
  const garage = demoGarage(now);
  assert.equal(garage.items.length, 8);
  assert.equal(new Set(garage.items.map(i => i.kind)).size, 8);
  for (const item of garage.items) {
    assert.equal(itemStatus(item, now, garage.vehicle.odometer), item.kind === 'wash' ? 'overdue' : item.kind === 'oil' ? 'due_soon' : 'ok');
  }
  assert.equal(garage.items.find(i => i.kind === 'wash').lastDoneAt, '2026-09-26T12:00:00.000Z');
  assert.match(garage.vehicle.home.label, /Buena Park City Hall/);
  garage.vehicle.odometer = 50000;
  garage.proposals.push({ state: 'pending' });
  assert.equal(demoGarage(now).vehicle.odometer, 48000);
  assert.deepEqual(demoGarage(now).proposals, []);
});
