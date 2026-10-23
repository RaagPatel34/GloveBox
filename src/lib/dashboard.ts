import { BASELINE_INTERVALS, estimateOdometer, itemStatus } from "./intervals";
import { tighterLimit, type Limit } from "./limits";
import { intervalUsed } from "./readout";
import type { ItemStatus, ScheduleItem, ScheduleItemKind, Vehicle } from "./types";

// Everything the dashboard needs to know about one car. This is the seam for loading:
// the fixture builds one today, and the saved-car flow builds one from storage later.
export type CarSnapshot = {
  vehicle: Vehicle;
  // ISO timestamp of when `vehicle.odometer` was read.
  readingAt: string;
  // Miles from trips the user has planned but not yet driven.
  plannedTripMiles?: number;
  items: ScheduleItem[];
};

export type DashboardItem = {
  id: string;
  kind: ScheduleItemKind;
  label: string;
  status: ItemStatus;
  limit: Limit | null;
  // Whole-number share of the interval used. Can exceed 100 when overdue. Null if unknown.
  usedPercent: number | null;
  source: ScheduleItem["intervalSource"];
};

export type Dashboard = {
  vehicle: Vehicle;
  readingAt: Date;
  odometerEstimate: number;
  items: DashboardItem[];
  counts: Record<ItemStatus, number>;
};

const STATUS_RANK: Record<ItemStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

export function buildDashboard(car: CarSnapshot, now: Date): Dashboard {
  const { vehicle } = car;
  const readingAt = new Date(car.readingAt);
  const odometerEstimate = estimateOdometer(vehicle, readingAt, now, car.plannedTripMiles ?? 0);

  const items = car.items.map((item): DashboardItem => {
    const used = intervalUsed(item, now, odometerEstimate);
    return {
      id: item.id,
      kind: item.kind,
      label: BASELINE_INTERVALS[item.kind].label,
      // Recomputed from the due targets: the stored status goes stale as time passes.
      status: itemStatus(item, now, odometerEstimate),
      limit: tighterLimit(item, now, odometerEstimate, vehicle.weeklyMiles),
      usedPercent: used === null ? null : Math.round(used * 100),
      source: item.intervalSource,
    };
  });

  items.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      (a.limit?.inDays ?? Infinity) - (b.limit?.inDays ?? Infinity) ||
      0,
  );

  const counts: Record<ItemStatus, number> = { overdue: 0, due_soon: 0, ok: 0 };
  for (const item of items) counts[item.status]++;

  return { vehicle, readingAt, odometerEstimate, items, counts };
}

// One tile per digit, zero-padded to at least six places like a real odometer.
export function odometerDigits(miles: number): string[] {
  return String(Math.max(0, Math.round(miles))).padStart(6, "0").split("");
}
