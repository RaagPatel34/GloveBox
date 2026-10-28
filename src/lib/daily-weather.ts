import { randomUUID } from 'node:crypto';
import { loadCar } from './db/car-store';
import { getSql } from './db/sql';
import { claimWeatherChecks, finishWeatherCheck } from './db/weather-check-store';
import { checkConditions } from './nudge-check';

export async function runDailyWeather(now = new Date()) {
  const claimed = await claimWeatherChecks(now);
  let complete = 0;
  let failed = 0;
  // Ten cars, checked concurrently; weather clients enforce six-second timeouts.
  await Promise.all(claimed.map(async ({ vehicle_id, visitor_id }) => {
    try {
      const car = await loadCar(visitor_id);
      if (!car || car.vehicle.id !== vehicle_id) return;
      const result = await checkConditions(car, now);
      if (!result.complete) {
        failed++;
        await finishWeatherCheck(vehicle_id, now, 'Weather unavailable; try the manual check.');
        return;
      }
      const wash = car.items.find(i => i.kind === 'wash');
      const sql = getSql();
      // Recheck consent and the wash state after the network request. A service logged
      // while weather was loading must not receive a suggestion for its old due date.
      await sql`WITH eligible AS (
        SELECT v.id FROM vehicles v JOIN weather_checks c ON c.vehicle_id = v.id
        LEFT JOIN schedule_items s ON s.vehicle_id = v.id AND s.kind = 'wash'
        WHERE v.id = ${vehicle_id} AND c.enabled
          AND s.last_done_at IS NOT DISTINCT FROM ${wash?.lastDoneAt ?? null}::timestamptz
          AND s.due_at IS NOT DISTINCT FROM ${wash?.dueAt ?? null}::timestamptz
          AND s.due_odometer IS NOT DISTINCT FROM ${wash?.dueOdometer ?? null}::integer
          AND v.odometer = ${car.vehicle.odometer}
      ), cleared AS (
        DELETE FROM nudges WHERE vehicle_id IN (SELECT id FROM eligible) RETURNING id
      ) INSERT INTO nudges (id, vehicle_id, text, reason, created_at)
        SELECT ${randomUUID()}, id, ${result.nudge?.text ?? ''}, ${result.nudge?.reason ?? ''}, ${now.toISOString()}
        FROM eligible WHERE ${result.nudge !== null} AND (SELECT count(*) FROM cleared) >= 0`;
      complete++;
      await finishWeatherCheck(vehicle_id, now, result.nudge ? 'Forecast checked; guidance refreshed.' : 'Forecast checked; no weather guidance needed.');
    } catch {
      failed++;
      // Do not log visitor tokens, connection strings, coordinates, or provider payloads.
      await finishWeatherCheck(vehicle_id, now, 'Check unavailable; try again later.').catch(() => {});
    }
  }));
  return { checked: claimed.length, complete, failed };
}
