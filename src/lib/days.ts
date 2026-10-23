// The .ts extension lets `npm run eval:router` load this file under plain Node.
import { DAY_MS } from "./intervals.ts";

// Calendar days as the user sees them. GloveBox is used in California, so "today",
// "yesterday" and the day something is due are days there.

const pacificDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

// YYYY-MM-DD in California, `daysBack` days before `now`.
export function pacificDate(now: Date, daysBack = 0): string {
  const today = new Date(`${pacificDay.format(now)}T12:00:00.000Z`);
  return new Date(today.getTime() - daysBack * DAY_MS).toISOString().slice(0, 10);
}
