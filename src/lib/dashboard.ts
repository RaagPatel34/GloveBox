import { BASELINE_INTERVALS, estimateCarOdometer, itemStatus, STATUS_RANK } from "./intervals";
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


function compareAscending(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function buildDashboard(car: CarSnapshot, now: Date): Dashboard {
  const { vehicle } = car;
  const readingAt = new Date(car.readingAt);
  const odometerEstimate = estimateCarOdometer(car, now);

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
      // Items with no limit go last. Compared explicitly: Infinity - Infinity is NaN.
      compareAscending(a.limit?.inDays ?? Infinity, b.limit?.inDays ?? Infinity),
  );

  const counts: Record<ItemStatus, number> = { overdue: 0, due_soon: 0, ok: 0, unknown: 0 };
  for (const item of items) counts[item.status]++;

  return { vehicle, readingAt, odometerEstimate, items, counts };
}

// One tile per digit, zero-padded to at least six places like a real odometer.
// A value that is not a finite number reads as zero rather than "NaN".
export function odometerDigits(miles: number): string[] {
  const whole = Number.isFinite(miles) ? Math.max(0, Math.round(miles)) : 0;
  return String(whole).padStart(6, "0").split("");
}
