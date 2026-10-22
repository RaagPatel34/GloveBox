import type { ItemStatus, ScheduleItem, ScheduleItemKind, Vehicle } from "./types";

// Starting defaults. Overridden per vehicle when Tavily finds a manufacturer schedule.
export const BASELINE_INTERVALS: Record<
  ScheduleItemKind,
  { label: string; days?: number; miles?: number }
> = {
  wash: { label: "Exterior wash", days: 14 },
  tire_pressure: { label: "Tire pressure check", days: 30 },
  oil: { label: "Oil change (synthetic)", days: 365, miles: 7500 },
  tire_rotation: { label: "Tire rotation", miles: 7500 },
  wipers: { label: "Wiper blades", days: 365 },
  cabin_filter: { label: "Cabin air filter", days: 365, miles: 15000 },
  engine_filter: { label: "Engine air filter", miles: 20000 },
  brake_check: { label: "Brake inspection", days: 365, miles: 12000 },
};

export const DUE_SOON_DAYS = 7;
export const DUE_SOON_MILES = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

// Last reading plus the weekly baseline since then, plus miles from planned trips.
export function estimateOdometer(
  vehicle: Pick<Vehicle, "odometer" | "weeklyMiles">,
  readingAt: Date,
  now: Date,
  plannedTripMiles = 0,
): number {
  const weeks = Math.max(0, (now.getTime() - readingAt.getTime()) / (7 * DAY_MS));
  return Math.round(vehicle.odometer + vehicle.weeklyMiles * weeks + plannedTripMiles);
}

export function itemStatus(
  item: Pick<ScheduleItem, "dueAt" | "dueOdometer">,
  now: Date,
  currentOdometer: number,
): ItemStatus {
  const daysLeft =
    item.dueAt === undefined ? Infinity : (new Date(item.dueAt).getTime() - now.getTime()) / DAY_MS;
  const milesLeft =
    item.dueOdometer === undefined ? Infinity : item.dueOdometer - currentOdometer;

  if (daysLeft < 0 || milesLeft < 0) return "overdue";
  if (daysLeft <= DUE_SOON_DAYS || milesLeft <= DUE_SOON_MILES) return "due_soon";
  return "ok";
}
