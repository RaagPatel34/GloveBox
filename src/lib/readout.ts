import { DAY_MS } from "./intervals";
import type { Limit } from "./limits";
import type { ScheduleItem } from "./types";

// Numbers and words for an upkeep tile. Pure, so the wording is tested once.

type IntervalFields = Pick<ScheduleItem, "intervalDays" | "intervalMiles" | "dueAt" | "dueOdometer">;

// How much of the current interval is used up: 0 just after service, 1 at the due
// point, above 1 when overdue. Time and miles are both measured, and the one further
// along wins. The interval's start is worked back from the due target, so a due date
// moved by a proposal still gives a sensible reading. Null if there is nothing to measure.
export function intervalUsed(item: IntervalFields, now: Date, currentOdometer: number): number | null {
  const shares: number[] = [];

  if (item.intervalDays !== undefined && item.dueAt !== undefined) {
    const daysLeft = (new Date(item.dueAt).getTime() - now.getTime()) / DAY_MS;
    shares.push((item.intervalDays - daysLeft) / item.intervalDays);
  }
  if (item.intervalMiles !== undefined && item.dueOdometer !== undefined) {
    const milesLeft = item.dueOdometer - currentOdometer;
    shares.push((item.intervalMiles - milesLeft) / item.intervalMiles);
  }

  if (shares.length === 0) return null;
  return Math.max(0, ...shares);
}

const numberFormat = new Intl.NumberFormat("en-US");

// The big number on a tile and the words that go with it. Always written out,
// never left to colour.
export function formatLimit(limit: Limit | null): { value: string; unit: string } {
  if (limit === null) return { value: "—", unit: "No due date" };

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
