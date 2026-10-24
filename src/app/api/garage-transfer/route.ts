import { cookies } from 'next/headers';
import { boundedJson, sameOrigin } from '@/lib/request-json';
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitor';
import { prepareTransfer } from '@/lib/garage-transfer';
import { saveCar, loadCar } from '@/lib/db/car-store';
import { getSql } from '@/lib/db/sql';
import type { Garage } from '@/lib/maintenance';

async function identity() { return (await cookies()).get(VISITOR_COOKIE)?.value; }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Copy from this website only.' }, 403);
  const visitor = await identity();
  if (!isVisitorId(visitor)) return json({ error: 'Your browser identity is not ready. Reload and try again.' }, 401);
  if (!process.env.DATABASE_URL) return json({ error: 'The cloud database is not connected yet. Your local records are safe.' }, 503);
  let garage;
  try { garage = prepareTransfer(await boundedJson(request, 500000), visitor); }
  catch (error) { return json({ error: (error as Error).message }, 400); }
  try {
    if (await loadCar(visitor)) return json({ error: 'A cloud car already exists. Export it first; this copy flow never overwrites it.' }, 409);
    // Full copy retained atomically with the car. Existing proposal history is an
    // archive, not newly actionable cloud suggestions, so old cards cannot reapply.
    await saveCar(visitor, garage, [], { extra: JSON.stringify(garage) });
    return json({ message: 'Car and reminders copied. Service history and proposal history are preserved in the downloadable copy. Local records are unchanged.' });
  } catch (error) {
    if ((error as {code?: string}).code === '23505') return json({ error: 'A cloud car was saved while you were copying. Nothing was overwritten.' }, 409);
    return json({ error: 'Could not copy the garage. Check the database connection and migration; local records are unchanged.' }, 503);
  }
}

export async function GET() {
  const visitor = await identity();
  if (!isVisitorId(visitor)) return json({ error: 'Open your cloud garage first.' }, 401);
  if (!process.env.DATABASE_URL) return json({ error: 'The cloud database is not connected yet.' }, 503);
  try {
    const sql = getSql();
    const rows = await sql`SELECT garage_extra FROM vehicles WHERE visitor_id = ${visitor}`;
    const original = rows[0]?.garage_extra as Garage | undefined;
    if (!original) return json({ error: 'No transferred garage archive exists for this browser.' }, 404);
    // Deliberately export the exact transferred archive, not a false merge with
    // cloud edits. The UI labels this snapshot and offers review before restoring.
    return json({ garage: original });
  } catch { return json({ error: 'Could not read the saved copy. Try again later.' }, 503); }
}
