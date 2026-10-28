// Run against the locally started app, using the same .env.local as next start.
// Creates one isolated fictional visitor and deletes only that visitor's test car.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { demoGarage } from '../src/lib/maintenance.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Finish neon deploy first.');
const base = new URL(process.env.APP_TEST_URL || 'http://localhost:3000');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('This verification is restricted to the local app.');
const sql = neon(process.env.DATABASE_URL);
const visitor = randomUUID();
const otherVisitor = randomUUID();
const cookie = `gb_visitor=${visitor}`;
const garage = demoGarage();
garage.services = [{ id: randomUUID(), itemId: 'wash', date: '2026-10-01', odometer: 47000, notes: 'Neon end-to-end test fixture', createdAt: '2026-10-01T12:00:00Z' }];
const request = (path: string, init: RequestInit = {}) => fetch(new URL(path, base), {
  ...init, headers: { cookie, origin: base.origin, ...init.headers }, signal: AbortSignal.timeout(20000),
});
try {
  const connection = await sql`SELECT 1 AS connected`;
  assert.equal(connection[0].connected, 1);
  console.log('PASS Neon Postgres connection');
  const created = await request('/api/garage-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(garage) });
  assert.equal(created.status, 200, 'The app must save the fictional car through its HTTP endpoint.');
  const rows = await sql`SELECT id FROM vehicles WHERE visitor_id = ${visitor}`;
  assert.equal(rows.length, 1);
  const items = await sql`SELECT count(*)::integer AS count FROM schedule_items WHERE vehicle_id = ${rows[0].id}`;
  assert.equal(items[0].count, 8);
  console.log('PASS App HTTP save → Neon: one car and eight reminders');
  const archive = await request('/api/garage-transfer');
  assert.equal(archive.status, 200);
  const saved = await archive.json();
  assert.equal(saved.garage.services[0].notes, garage.services[0].notes);
  console.log('PASS Neon → app HTTP read: service notes preserved');
  const duplicate = await request('/api/garage-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(garage) });
  assert.equal(duplicate.status, 409);
  const isolated = await request('/api/garage-transfer', { headers: { cookie: `gb_visitor=${otherVisitor}` } });
  assert.equal(isolated.status, 404);
  console.log('PASS Existing-car protection and visitor isolation');
  const page = await request('/garage');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes('Civic') && !html.includes('Cloud garage is not connected yet'));
  console.log('PASS Cloud dashboard renders the persisted car');
  for (const enabled of [true, false]) {
    const response = await request('/api/weather-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    assert.equal(response.status, 200);
    const preference = await sql`SELECT enabled FROM weather_checks WHERE vehicle_id = ${rows[0].id}`;
    assert.equal(preference[0].enabled, enabled);
  }
  console.log('PASS App weather preference persists opt-in and opt-out (no weather call)');
} finally {
  await sql`DELETE FROM vehicles WHERE visitor_id = ${visitor}`;
  const remaining = await sql`SELECT count(*)::integer AS count FROM vehicles WHERE visitor_id = ${visitor}`;
  assert.equal(remaining[0].count, 0);
  console.log('PASS Isolated test records cleaned up');
}
