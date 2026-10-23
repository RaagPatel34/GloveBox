import { DAY_MS } from "./intervals";
import type { Limit } from "./limits";
import type { ItemStatus, ScheduleItem } from "./types";

// Numbers and words for an upkeep tile. Pure, so the wording is tested once.

type IntervalFields = Pick<ScheduleItem, "intervalDays" | "intervalMiles" | "dueAt" | "dueOdometer">;

// How much of the current interval is used up: 0 just after service, 1 at the due
// point, above 1 when overdue. Time and miles are both measured, and the one further
// along wins. The interval's start is worked back from the due target, so a due date
// moved by a proposal still gives a sensible reading. Null if there is nothing usable to
// measure: no interval, a zero or non-numeric interval, or an unreadable due date or mileage.
export function intervalUsed(item: IntervalFields, now: Date, currentOdometer: number): number | null {
  const shares: number[] = [];

  if (item.intervalDays !== undefined && item.dueAt !== undefined) {
    const daysLeft = (new Date(item.dueAt).getTime() - now.getTime()) / DAY_MS;
    pushShare(shares, item.intervalDays, daysLeft);
  }
  if (item.intervalMiles !== undefined && item.dueOdometer !== undefined) {
    pushShare(shares, item.intervalMiles, item.dueOdometer - currentOdometer);
  }

  if (shares.length === 0) return null;
  return Math.max(0, ...shares);
}

// Adds how much of an interval is used, but only when both numbers can be trusted.
function pushShare(shares: number[], interval: number, left: number): void {
  if (!(interval > 0) || !Number.isFinite(interval) || !Number.isFinite(left)) return;
  shares.push((interval - left) / interval);
}

// Status is always written out, never left to colour alone.
export const STATUS_LABEL: Record<ItemStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "OK",
};

export const numberFormat = new Intl.NumberFormat("en-US");

// GloveBox is a US, California app, so dates are shown in Pacific time. Fixing the
// zone keeps the server-rendered day the same as the viewer's, wherever the server runs.
const readDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

// "Oct 22" for the day an odometer reading was taken; a dash if the date is unreadable.
export function formatReadDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? "—" : readDateFormat.format(date);
}

// The big number on a tile and the words that go with it. Always written out,
// never left to colour. A limit that is not a finite number reads as no due date.
export function formatLimit(limit: Limit | null): { value: string; unit: string } {
  if (limit === null || !Number.isFinite(limit.remaining)) return { value: "—", unit: "No due date" };

  if (limit.kind === "miles") {
    const miles = numberFormat.format(Math.round(Math.abs(limit.remaining)));
    return { value: miles, unit: limit.remaining < 0 ? "mi over" : "mi left" };
  }

  if (limit.remaining < 0) {
    const days = Math.ceil(-limit.remaining);
    return { value: String(days), unit: days === 1 ? "day late" : "days late" };
  }

  const days = Math.floor(limit.remaining);
  if (days === 0) return { value: "Today", unit: "" };
  return { value: String(days), unit: days === 1 ? "day left" : "days left" };
}
