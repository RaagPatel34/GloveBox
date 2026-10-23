import { BASELINE_INTERVALS, DAY_MS, itemStatus } from "./intervals";
import type { ScheduleItem, ScheduleItemKind } from "./types";

// The schedule a brand-new vehicle starts with: one item per baseline kind.
// We know nothing about past service, so each clock starts at the odometer reading:
// due one full interval after it. No lastDone* is invented.
export function buildBaselineSchedule(
  start: { vehicleId: string; odometer: number; readingAt: Date },
  newId: () => string,
): ScheduleItem[] {
  const kinds = Object.keys(BASELINE_INTERVALS) as ScheduleItemKind[];
  return kinds.map((kind): ScheduleItem => {
    const { days, miles } = BASELINE_INTERVALS[kind];
    const dueAt =
      days === undefined ? undefined : new Date(start.readingAt.getTime() + days * DAY_MS).toISOString();
    const dueOdometer = miles === undefined ? undefined : start.odometer + miles;
    return {
      id: newId(),
      vehicleId: start.vehicleId,
      kind,
      intervalDays: days,
      intervalMiles: miles,
      dueAt,
      dueOdometer,
      status: itemStatus({ dueAt, dueOdometer }, start.readingAt, start.odometer),
      intervalSource: { kind: "baseline" },
    };
  });
}
