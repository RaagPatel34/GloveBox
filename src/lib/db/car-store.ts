import { fromRows, toRows, type ItemRow, type VehicleRow } from "../car-rows";
import type { CarSnapshot } from "../types";
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

// Replaces whatever car the visitor had with this one, atomically: the vehicle and all
// of its schedule items land together or not at all.
export async function saveCar(visitorId: string, snapshot: CarSnapshot): Promise<void> {
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
  ]);
}
