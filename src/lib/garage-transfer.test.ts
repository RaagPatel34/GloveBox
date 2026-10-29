import { expect, it } from 'vitest';
import { prepareTransfer } from './garage-transfer';
import { demoGarage, isGarage } from './maintenance';
it('remaps linked identities and preserves history without mutating the local copy', () => {
  const local = demoGarage(new Date('2026-10-23'));
  local.services = [{ id: 'service', itemId: 'wash', date: '2026-10-01', odometer: 47000, notes: 'Washed', createdAt: '2026-10-01T12:00:00Z' }];
  const before = structuredClone(local);
  const copy = prepareTransfer(local, 'new-owner');
  expect(copy.vehicle.id).not.toBe(local.vehicle.id);
  expect(copy.services?.[0].itemId).toBe(copy.items.find(i => i.kind === 'wash')?.id);
  expect(copy.vehicle.visitorId).toBe('new-owner');
  expect(isGarage(copy)).toBe(true);
  expect(local).toEqual(before);
});
it('rejects duplicate kinds and invalid database-bound numeric fields', () => {
  const local = demoGarage();
  local.items.push({ ...local.items[0], id: 'another-wash' });
  expect(() => prepareTransfer(local, 'owner')).toThrow('one reminder');
  local.items.pop(); local.vehicle.home.lat = 999;
  expect(() => prepareTransfer(local, 'owner')).toThrow('location');
  local.vehicle.home.lat = 0; local.vehicle.odometer = 1.5;
  expect(() => prepareTransfer(local, 'owner')).toThrow('whole-mile');
});
