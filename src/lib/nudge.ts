import type { CarSnapshot, ItemStatus } from "./types";
import type { AirQuality, ForecastDay, WeatherForecast } from "./weather";

// Decides whether the weather and air call for a nudge, and words it. Pure: the caller
// fetches the data (nudge-check.ts) and stores the result (db/nudge-store.ts).
//
// Two rules, smoke first because it is the more urgent:
//   - smoke or ash (high PM2.5)  -> wash plus a cabin air filter check
//   - rain close by, wash due    -> hold the wash, wash on the first dry day ("rain Thursday, wash Friday")
// and one that keeps a clear forecast from being silent when it matters:
//   - no rain close by, wash due -> a dry window to wash in
// Anything else is no nudge. Every nudge carries the reading that caused it as its reason.

export type NudgeDraft = { text: string; reason: string };

// US EPA's "unhealthy for sensitive groups" line for PM2.5 (µg/m³): below it, city air is not smoke.
export const SMOKE_PM25 = 35.5;

// Rain this many days out (today included) would undo a wash done now. Further out, wash first.
const RAIN_WINDOW_DAYS = 3;
// A day is rainy if it is likely to rain and enough falls to spot a car. A stray drizzle
// (0.012 in, 0% chance) is neither.
const RAIN_CHANCE = 50;
const RAIN_INCHES = 0.02;
// With no chance given, only a real amount counts.
const RAIN_INCHES_UNSURE = 0.1;

// A nudge reflects a forecast that is a day or two old at most; after this it is not shown.
export const NUDGE_TTL_MS = 36 * 60 * 60 * 1000;

// Nudges made at or before this moment are no longer shown (and can be deleted).
export const nudgeCutoff = (now: Date): Date => new Date(now.getTime() - NUDGE_TTL_MS);

// True when the car's wash was logged or rescheduled between two snapshots. Every stored nudge
// was worded against the wash's state at the time ("the wash is overdue, but rain would undo
// it"), so it no longer holds; the next check (the daily job, #16) writes a fresh one.
export function washChanged(before: CarSnapshot, after: CarSnapshot): boolean {
  const key = (car: CarSnapshot) => {
    const wash = car.items.find((item) => item.kind === "wash");
    return JSON.stringify([wash?.lastDoneAt, wash?.lastDoneOdometer, wash?.dueAt, wash?.dueOdometer]);
  };
  return key(before) !== key(after);
}

export type NudgeInput = {
  // Either may be missing when its service could not be reached: the other still counts.
  weather?: WeatherForecast;
  air?: AirQuality;
  // Status of the car's wash item. Undefined when it has none.
  washStatus?: ItemStatus;
  // Where the car lives, for the reason ("near Buena Park, CA").
  place: string;
};

export function evaluateNudge({ weather, air, washStatus, place }: NudgeInput): NudgeDraft | null {
  if (air !== undefined && air.pm25Peak24h >= SMOKE_PM25) return smokeNudge(air, place);
  if (weather === undefined || (washStatus !== "overdue" && washStatus !== "due_soon")) return null;
  return washNudge(weather, washStatus === "overdue" ? "overdue" : "due soon", place);
}

function smokeNudge(air: AirQuality, place: string): NudgeDraft {
  const now = Math.round(air.pm25Now);
  const peak = Math.round(air.pm25Peak24h);
  const reading =
    peak > now ? `${now} µg/m³ now and may reach ${peak} over the next 24 hours` : `${now} µg/m³ now`;
  const aqi = air.usAqi === null ? "" : ` (US AQI ${air.usAqi})`;
  // Smoke already here: ash is falling. Smoke only forecast: the filter check is the part that applies now.
  const text =
    air.pm25Now >= SMOKE_PM25
      ? "Smoky air: rinse the ash off soon and check the cabin air filter."
      : "Smoke expected: check the cabin air filter, and rinse the ash off once the air clears.";
  return {
    text,
    reason:
      `PM2.5 is ${reading} near ${place}${aqi}. ` +
      `From ${SMOKE_PM25} µg/m³ up the air is unhealthy for sensitive people, ` +
      "and smoke carries ash and fine particles that dirty paint and cabin filters.",
  };
}

const isRainy = (day: ForecastDay): boolean =>
  day.rainInches >= RAIN_INCHES &&
  (day.rainChance === null ? day.rainInches >= RAIN_INCHES_UNSURE : day.rainChance >= RAIN_CHANCE);

// A date written YYYY-MM-DD is a calendar day, not an instant: read it at noon UTC so the
// weekday cannot shift with the server's timezone.
function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

// Day 0 is the car's local today: Open-Meteo is asked for `timezone=auto`.
function dayName(days: ForecastDay[], index: number): string {
  return index === 0 ? "today" : index === 1 ? "tomorrow" : weekday(days[index].date);
}

function washNudge(weather: WeatherForecast, washState: string, place: string): NudgeDraft | null {
  const { days } = weather;
  const firstRain = days.findIndex(isRainy);

  if (firstRain === -1 || firstRain >= RAIN_WINDOW_DAYS) {
    // A dry window to wash in, up to the next rain (or the end of the forecast).
    const lastDry = firstRain === -1 ? days.length - 1 : firstRain - 1;
    // "All week" only for a full week: a forecast cut short says how far it goes.
    const horizon =
      firstRain !== -1 ? `until ${dayName(days, firstRain)}` : days.length >= 7 ? "all week" : `through ${weekday(days[lastDry].date)}`;
    return {
      text: `Dry ${horizon}, a good time to wash.`,
      reason: `No rain in Open-Meteo's forecast through ${weekday(days[lastDry].date)} near ${place}, and the wash is ${washState}.`,
    };
  }

  let lastRain = firstRain;
  while (lastRain + 1 < days.length && isRainy(days[lastRain + 1])) lastRain++;
  const run = days.slice(firstRain, lastRain + 1);

  const first = dayName(days, firstRain);
  const span = lastRain === firstRain ? first : `${first} through ${dayName(days, lastRain)}`;
  const washDay = lastRain + 1 < days.length ? dayName(days, lastRain + 1) : null;

  const inches = run.reduce((sum, day) => sum + day.rainInches, 0).toFixed(2);
  const chances = run.flatMap((day) => (day.rainChance === null ? [] : [day.rainChance]));
  const chance = chances.length === 0 ? "" : ` (${Math.max(...chances)}% chance)`;
  // "rain on Saturday" but "rain today" / "rain tomorrow" / "rain Friday through Saturday".
  const when = lastRain === firstRain && firstRain >= 2 ? `on ${span}` : span;

  return {
    text: `Rain ${span}, ${washDay === null ? "hold the wash until it clears" : `wash ${washDay}`}.`,
    reason:
      `Open-Meteo forecasts ${inches} in of rain ${when}${chance} near ${place}. ` +
      `The wash is ${washState}, but rain would undo it.`,
  };
}
