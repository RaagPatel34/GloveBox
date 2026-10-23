// The .ts extension lets `npm run eval:router` load this file under plain Node.
import { DAY_MS, isPlainDate } from "./intervals.ts";

// Calendar days as the user sees them. GloveBox is used in California, so "today",
// "yesterday" and the day something is due are days there.

const pacificDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

// YYYY-MM-DD in California, `daysBack` days before `now`.
export function pacificDate(now: Date, daysBack = 0): string {
  const today = new Date(`${pacificDay.format(now)}T12:00:00.000Z`);
  return new Date(today.getTime() - daysBack * DAY_MS).toISOString().slice(0, 10);
}

// A calendar day "2026-10-25" as a moment: noon UTC, which is the same day in California.
// Null for anything that is not a real day in that form; a day past the month's end
// would otherwise roll over into the next month.
export function parsePlainDate(raw: unknown): Date | null {
  if (!isPlainDate(raw)) return null;
  const date = new Date(`${raw}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? date : null;
}

// Whether two due dates fall on the same day in California. A due date set to a day is
// pinned to noon, but one set by a logged service keeps that moment's time, so the two are
// compared by day, never by timestamp. Two absent dates are the same; one absent is not.
export function sameDueDay(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return pacificDate(new Date(a)) === pacificDate(new Date(b));
}
