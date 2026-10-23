import { DAY_MS } from "./intervals";
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

// Miles to days at the weekly-miles rate. A car that is not driven never
// reaches a mileage that is still ahead, and has already passed one that is behind.
export function milesToDays(miles: number, weeklyMiles: number): number {
  if (miles === 0) return 0;
  if (weeklyMiles <= 0) return miles > 0 ? Infinity : -Infinity;
  return miles / (weeklyMiles / 7);
}

// Whichever of the date or the mileage runs out first (a tie goes to the date).
// Returns null when the item has no due target.
export function tighterLimit(
  item: DueTarget,
  now: Date,
  currentOdometer: number,
  weeklyMiles: number,
): Limit | null {
  let byDate: Limit | null = null;
  if (item.dueAt !== undefined) {
    const days = (new Date(item.dueAt).getTime() - now.getTime()) / DAY_MS;
    byDate = { kind: "days", remaining: days, inDays: days };
  }

  let byMiles: Limit | null = null;
  if (item.dueOdometer !== undefined) {
    const miles = item.dueOdometer - currentOdometer;
    byMiles = { kind: "miles", remaining: miles, inDays: milesToDays(miles, weeklyMiles) };
  }

  if (byDate && byMiles) return byMiles.inDays < byDate.inDays ? byMiles : byDate;
  return byDate ?? byMiles;
}
