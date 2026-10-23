import { fromRows, toRows, type ItemRow, type VehicleRow } from "../car-rows";
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
  return fromRows(vehicles[0], items);
}

// Writes back what the agents can change on an existing car: the odometer reading and each
// item's service and due fields. Updated in place rather than replaced, so rows that hang off
// the vehicle (proposals, nudges) are kept. Scoped to the visitor's own vehicle.
export async function updateCar(visitorId: string, snapshot: CarSnapshot): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { vehicle, items } = toRows(visitorId, snapshot);

  await sql.transaction([
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
export async function saveCar(visitorId: string, snapshot: CarSnapshot, nudges: Nudge[] = []): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { vehicle, items } = toRows(visitorId, snapshot);

  await sql.transaction([
    sql`DELETE FROM vehicles WHERE visitor_id = ${visitorId}`,
    sql`INSERT INTO vehicles (id, visitor_id, year, make, model, epa_mpg, mpg_override, odometer,
          weekly_miles, home_label, home_lat, home_lng, reading_at)
        VALUES (${vehicle.id}, ${vehicle.visitor_id}, ${vehicle.year}, ${vehicle.make}, ${vehicle.model},
          ${vehicle.epa_mpg}, ${vehicle.mpg_override}, ${vehicle.odometer}, ${vehicle.weekly_miles},
          ${vehicle.home_label}, ${vehicle.home_lat}, ${vehicle.home_lng}, ${vehicle.reading_at})`,
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
