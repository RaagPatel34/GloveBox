import { fromRows, toRows, type ItemRow, type VehicleRow } from "../car-rows";
import { washChanged } from "../nudge";
import { nudgeToRow } from "../nudge-rows";
import type { CarSnapshot, Nudge } from "../types";
import { isVisitorId } from "../visitor";
import { getSql } from "./sql";

// Postgres access for the visitor's car. Kept thin: the interesting logic is in car-rows.ts.

// The caller validates the visitor ID (getCarSnapshot does); a malformed one just finds no row.
export async function loadCar(visitorId: string): Promise<CarSnapshot | null> {
  const sql = getSql();
  const vehicles = (await sql`SELECT * FROM vehicles WHERE visitor_id = ${visitorId}`) as VehicleRow[];
  if (vehicles.length === 0) return null;
  const items = (await sql`SELECT * FROM schedule_items WHERE vehicle_id = ${vehicles[0].id}`) as ItemRow[];
  const snapshot = fromRows(vehicles[0], items);
  const extra = (vehicles[0] as VehicleRow & {garage_extra?: import('../maintenance').Garage}).garage_extra;
  if (extra) {
    snapshot.plannedTripMiles = extra.plannedTripMiles;
    snapshot.vehicle.isDemo = extra.vehicle.isDemo;
    snapshot.vehicle.mpgSource = extra.vehicle.mpgSource;
    snapshot.items = snapshot.items.map(item => {
      const original = extra.items.find(i => i.id === item.id);
      return {...item, intervalSource: original?.intervalSource ?? item.intervalSource,
        reminderOrigin: original?.reminderOrigin};
    });
  }
  return snapshot;
}

// Writes back what the agents can change on an existing car: the odometer reading and each
// item's service and due fields. Updated in place rather than replaced, so rows that hang off
// the vehicle (proposals, nudges) are kept. Scoped to the visitor's own vehicle.
//
// Pass the snapshot the change started from as `previous`: if the wash was logged or moved,
// the car's stored nudges were worded for the old wash state, so they are dropped in the same
// transaction (the next nudge check writes fresh ones).
export async function updateCar(visitorId: string, snapshot: CarSnapshot, previous?: CarSnapshot): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { vehicle, items } = toRows(visitorId, snapshot);
  const dropNudges = previous !== undefined && washChanged(previous, snapshot);

  await sql.transaction([
    ...(dropNudges
      ? [
          sql`DELETE FROM nudges
              WHERE vehicle_id = (SELECT id FROM vehicles WHERE id = ${vehicle.id} AND visitor_id = ${visitorId})`,
        ]
      : []),
    sql`UPDATE vehicles SET odometer = ${vehicle.odometer}, reading_at = ${vehicle.reading_at}
        WHERE id = ${vehicle.id} AND visitor_id = ${visitorId}`,
    ...items.map(
      (item) =>
        sql`UPDATE schedule_items SET last_done_at = ${item.last_done_at}, last_done_odometer = ${item.last_done_odometer},
              due_at = ${item.due_at}, due_odometer = ${item.due_odometer}, status = ${item.status}
            WHERE id = ${item.id}
              AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${vehicle.id} AND visitor_id = ${visitorId})`,
    ),
  ]);
}

// Replaces whatever car the visitor had with this one, atomically: the vehicle, all of its
// schedule items and any nudges to start it with (the demo car's) land together or not at all.
export async function saveCar(visitorId: string, snapshot: CarSnapshot, nudges: Nudge[] = [], transfer?: { extra: string }): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { vehicle, items } = toRows(visitorId, snapshot);

  await sql.transaction([
    ...(transfer ? [] : [sql`DELETE FROM vehicles WHERE visitor_id = ${visitorId}`]),
    sql`INSERT INTO vehicles (id, visitor_id, year, make, model, epa_mpg, mpg_override, odometer,
          weekly_miles, home_label, home_lat, home_lng, reading_at, garage_extra)
        VALUES (${vehicle.id}, ${vehicle.visitor_id}, ${vehicle.year}, ${vehicle.make}, ${vehicle.model},
          ${vehicle.epa_mpg}, ${vehicle.mpg_override}, ${vehicle.odometer}, ${vehicle.weekly_miles},
          ${vehicle.home_label}, ${vehicle.home_lat}, ${vehicle.home_lng}, ${vehicle.reading_at}, ${transfer?.extra ?? null}::jsonb)`,
    ...items.map(
      (item) =>
        sql`INSERT INTO schedule_items (id, vehicle_id, kind, interval_days, interval_miles, last_done_at,
              last_done_odometer, due_at, due_odometer, status, interval_source_kind, interval_source_url)
            VALUES (${item.id}, ${item.vehicle_id}, ${item.kind}, ${item.interval_days}, ${item.interval_miles},
              ${item.last_done_at}, ${item.last_done_odometer}, ${item.due_at}, ${item.due_odometer},
              ${item.status}, ${item.interval_source_kind}, ${item.interval_source_url})`,
    ),
    ...nudges.map(nudgeToRow).map(
      (nudge) =>
        sql`INSERT INTO nudges (id, vehicle_id, text, reason, created_at)
            VALUES (${nudge.id}, ${nudge.vehicle_id}, ${nudge.text}, ${nudge.reason}, ${nudge.created_at})`,
    ),
  ]);
}
