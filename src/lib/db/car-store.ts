import { fromRows, toRows, type ItemRow, type VehicleRow } from "../car-rows";
import type { CarSnapshot } from "../types";
import { isVisitorId } from "../visitor";
import { getSql } from "./sql";

// Postgres access for the visitor's car. Kept thin: the interesting logic is in car-rows.ts.

export async function loadCar(visitorId: string): Promise<CarSnapshot | null> {
  if (!isVisitorId(visitorId)) return null;
  const sql = getSql();
  const vehicles = (await sql`SELECT * FROM vehicles WHERE visitor_id = ${visitorId}`) as VehicleRow[];
  if (vehicles.length === 0) return null;
  const items = (await sql`SELECT * FROM schedule_items WHERE vehicle_id = ${vehicles[0].id}`) as ItemRow[];
  return fromRows(vehicles[0], items);
}

// Replaces whatever car the visitor had with this one, atomically: the vehicle and all
// of its schedule items land together or not at all.
export async function saveCar(visitorId: string, snapshot: CarSnapshot): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { vehicle: v, items } = toRows(visitorId, snapshot);

  await sql.transaction([
    sql`DELETE FROM vehicles WHERE visitor_id = ${visitorId}`,
    sql`INSERT INTO vehicles (id, visitor_id, year, make, model, epa_mpg, mpg_override, odometer,
          weekly_miles, home_label, home_lat, home_lng, reading_at)
        VALUES (${v.id}, ${v.visitor_id}, ${v.year}, ${v.make}, ${v.model}, ${v.epa_mpg}, ${v.mpg_override},
          ${v.odometer}, ${v.weekly_miles}, ${v.home_label}, ${v.home_lat}, ${v.home_lng}, ${v.reading_at})`,
    ...items.map(
      (i) =>
        sql`INSERT INTO schedule_items (id, vehicle_id, kind, interval_days, interval_miles, last_done_at,
              last_done_odometer, due_at, due_odometer, status, interval_source_kind, interval_source_url)
            VALUES (${i.id}, ${i.vehicle_id}, ${i.kind}, ${i.interval_days}, ${i.interval_miles}, ${i.last_done_at},
              ${i.last_done_odometer}, ${i.due_at}, ${i.due_odometer}, ${i.status}, ${i.interval_source_kind},
              ${i.interval_source_url})`,
    ),
  ]);
}
