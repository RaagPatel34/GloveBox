import { BASELINE_INTERVALS, estimateOdometer, itemStatus, STATUS_RANK } from "./intervals";
import { tighterLimit, type Limit } from "./limits";
import { intervalUsed } from "./readout";
import type { CarSnapshot, ItemStatus, ScheduleItem, ScheduleItemKind, Vehicle } from "./types";

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
