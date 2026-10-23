import { DAY_MS, itemStatus, STATUS_RANK } from "./intervals";
import type { DueTarget } from "./types";

// Which limit an upkeep item runs out of first, and how far away it is.
// Pure and framework-free so the dashboard and tests share one definition.

export type Limit = {
  kind: "days" | "miles";
  // Signed distance in the limit's own unit. Negative means already past.
  remaining: number;
  // The same distance in days, for comparing and sorting across kinds.
  inDays: number;
};

// Miles to days at the weekly-miles rate. A car that is not driven (or whose weekly
// miles are unusable) never reaches a mileage that is still ahead, and has already
// passed one that is behind.
export function milesToDays(miles: number, weeklyMiles: number): number {
  if (miles === 0) return 0;
  if (!(weeklyMiles > 0)) return miles > 0 ? Infinity : -Infinity;
  return miles / (weeklyMiles / 7);
}

// The limit to show for an item. A date or mileage that cannot be read is treated as
// absent, so the result is never NaN. Returns null when there is no usable due target.
//
// When the item is overdue or due soon, this is the limit that actually triggered that
// status (status uses raw thresholds: 7 days, 500 miles), so the tile always explains
// itself. If both triggered it, the more urgent one wins (a tie goes to the date). When
// the item is OK, it is whichever runs out first at the weekly-miles rate.
export function tighterLimit(
  item: DueTarget,
  now: Date,
  currentOdometer: number,
  weeklyMiles: number,
): Limit | null {
  let byDate: Limit | null = null;
  if (item.dueAt !== undefined) {
    const days = (new Date(item.dueAt).getTime() - now.getTime()) / DAY_MS;
    if (Number.isFinite(days)) byDate = { kind: "days", remaining: days, inDays: days };
  }

  let byMiles: Limit | null = null;
  if (item.dueOdometer !== undefined) {
    const miles = item.dueOdometer - currentOdometer;
    if (Number.isFinite(miles)) {
      byMiles = { kind: "miles", remaining: miles, inDays: milesToDays(miles, weeklyMiles) };
    }
  }

  if (!byDate || !byMiles) return byDate ?? byMiles;

  // Each limit's own status, using the same rule as the item's status.
  const dateRank = STATUS_RANK[itemStatus({ dueAt: item.dueAt }, now, currentOdometer)];
  const milesRank = STATUS_RANK[itemStatus({ dueOdometer: item.dueOdometer }, now, currentOdometer)];
  if (dateRank !== milesRank) return dateRank < milesRank ? byDate : byMiles;
  return byMiles.inDays < byDate.inDays ? byMiles : byDate;
}
