import { getSql } from './sql';
import { isVisitorId } from '../visitor';

export async function weatherPreference(visitorId: string) {
  if (!isVisitorId(visitorId)) return null;
  const sql = getSql();
  const rows = await sql`SELECT COALESCE(w.enabled, false) AS enabled, w.checked_at, w.outcome
    FROM vehicles v LEFT JOIN weather_checks w ON w.vehicle_id = v.id WHERE v.visitor_id = ${visitorId}`;
  return rows[0] ?? null;
}

export async function setWeatherPreference(visitorId: string, enabled: boolean) {
  if (!isVisitorId(visitorId)) throw new Error('Invalid visitor');
  const sql = getSql();
  const rows = await sql`INSERT INTO weather_checks (vehicle_id, enabled)
    SELECT id, ${enabled} FROM vehicles WHERE visitor_id = ${visitorId}
      AND (NOT ${enabled} OR (home_lat BETWEEN -90 AND 90 AND home_lng BETWEEN -180 AND 180 AND NOT (home_lat = 0 AND home_lng = 0)))
    ON CONFLICT (vehicle_id) DO UPDATE SET enabled = EXCLUDED.enabled
    RETURNING vehicle_id`;
  return rows.length > 0;
}

// Claim a bounded batch atomically. Concurrent or repeated invocations cannot check
// the same car again within 24 hours; oldest work gets priority on the next run.
export async function claimWeatherChecks(now: Date) {
  const sql = getSql();
  return await sql`WITH selected AS (
    SELECT vehicle_id FROM weather_checks WHERE enabled AND next_check_at <= ${now.toISOString()}
    ORDER BY next_check_at, vehicle_id LIMIT 10 FOR UPDATE SKIP LOCKED
  ) UPDATE weather_checks w SET next_check_at = ${new Date(now.getTime() + 86400000).toISOString()}
    FROM selected s, vehicles v WHERE w.vehicle_id = s.vehicle_id AND v.id = w.vehicle_id
    RETURNING w.vehicle_id, v.visitor_id` as {vehicle_id: string; visitor_id: string}[];
}

export async function finishWeatherCheck(vehicleId: string, now: Date, outcome: string) {
  const sql = getSql();
  await sql`UPDATE weather_checks SET checked_at = ${now.toISOString()}, outcome = ${outcome}
    WHERE vehicle_id = ${vehicleId}`;
}
