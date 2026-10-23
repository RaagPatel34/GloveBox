import { BASELINE_INTERVALS, DAY_MS, estimateOdometer, itemStatus } from "./intervals";
import { MAX_ODOMETER } from "./setup";
import type { CarSnapshot, ItemStatus, ScheduleItem, ScheduleItemKind } from "./types";

// What the maintenance agent's write tools do to a car: log a service, correct the odometer.
// Pure, so the rules are tested without a model or a database. Each returns the new car
// plus an effect describing the change; the reply the user sees is written from the
// effects, so every number in it was computed here, never typed by the model.

export type ServiceLogged = {
  type: "service_logged";
  kind: ScheduleItemKind;
  label: string;
  doneAt: string;
  doneOdometer: number;
  status: ItemStatus;
};

export type OdometerUpdated = {
  type: "odometer_updated";
  // The estimate the dashboard showed before, and the reading now.
  from: number;
  to: number;
  statusChanges: { kind: ScheduleItemKind; label: string; from: ItemStatus; to: ItemStatus }[];
};

export type Result<E> = { ok: true; car: CarSnapshot; effect: E } | { ok: false; error: string };

export function isItemKind(value: unknown): value is ScheduleItemKind {
  return typeof value === "string" && Object.hasOwn(BASELINE_INTERVALS, value);
}

export function isOdometerReading(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_ODOMETER;
}

// Services logged further back than this are almost certainly a misread date.
const MAX_DAYS_BACK = 3 * 365;

// "2026-10-15" or a full ISO timestamp. A bare date is pinned to noon UTC, which is the
// same calendar day in California. Returns an error string for anything else.
function parseServiceDate(raw: string | undefined, now: Date): Date | string {
  if (raw === undefined) return now;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw) || Number.isNaN(date.getTime())) {
    return `"${raw}" is not a date. Use YYYY-MM-DD.`;
  }
  // A bare date for today is pinned to noon, which may still be ahead of `now`: use now.
  if (date.getTime() > now.getTime()) {
    return raw === now.toISOString().slice(0, 10) ? now : "That date is in the future.";
  }
  if (now.getTime() - date.getTime() > MAX_DAYS_BACK * DAY_MS) return "That date is too long ago to log.";
  return date;
}

// Marks an item as done on `date` (default: now) at `odometer` (default: the estimated
// reading on that day), and restarts its clocks from there.
export function logService(
  car: CarSnapshot,
  input: { kind: ScheduleItemKind; date?: string; odometer?: number },
  now: Date,
): Result<ServiceLogged> {
  if (!isItemKind(input.kind)) return { ok: false, error: `Unknown item "${String(input.kind)}".` };
  const item = car.items.find((i) => i.kind === input.kind);
  if (!item) return { ok: false, error: `This car has no ${input.kind} item.` };
  if (input.odometer !== undefined && !isOdometerReading(input.odometer)) {
    return { ok: false, error: `The odometer must be a whole number of miles up to ${MAX_ODOMETER}.` };
  }
  const doneAt = parseServiceDate(input.date, now);
  if (typeof doneAt === "string") return { ok: false, error: doneAt };

  const readingAt = new Date(car.readingAt);
  const doneOdometer = input.odometer ?? estimateOdometer(car.vehicle, readingAt, doneAt);
  const dueAt =
    item.intervalDays === undefined ? undefined : new Date(doneAt.getTime() + item.intervalDays * DAY_MS).toISOString();
  const dueOdometer = item.intervalMiles === undefined ? undefined : doneOdometer + item.intervalMiles;
  const odometerNow = estimateOdometer(car.vehicle, readingAt, now, car.plannedTripMiles ?? 0);

  const updated: ScheduleItem = {
    ...item,
    lastDoneAt: doneAt.toISOString(),
    lastDoneOdometer: doneOdometer,
    dueAt,
    dueOdometer,
    status: itemStatus({ dueAt, dueOdometer }, now, odometerNow),
  };

  return {
    ok: true,
    car: { ...car, items: car.items.map((i) => (i.id === item.id ? updated : i)) },
    effect: {
      type: "service_logged",
      kind: item.kind,
      label: BASELINE_INTERVALS[item.kind].label,
      doneAt: updated.lastDoneAt!,
      doneOdometer,
      status: updated.status,
    },
  };
}

// A fresh reading taken now. It replaces the estimate, so every mileage-based status is
// recomputed and stored. Lower readings are allowed: this is how a wrong one gets fixed.
export function updateOdometer(car: CarSnapshot, miles: number, now: Date): Result<OdometerUpdated> {
  if (!isOdometerReading(miles)) {
    return { ok: false, error: `The odometer must be a whole number of miles up to ${MAX_ODOMETER}.` };
  }

  const before = estimateOdometer(car.vehicle, new Date(car.readingAt), now, car.plannedTripMiles ?? 0);
  const vehicle = { ...car.vehicle, odometer: miles };
  const odometerNow = estimateOdometer(vehicle, now, now, car.plannedTripMiles ?? 0);

  const statusChanges: OdometerUpdated["statusChanges"] = [];
  const items = car.items.map((item): ScheduleItem => {
    // Compared against what the dashboard showed, not the stored status, which may be stale.
    const was = itemStatus(item, now, before);
    const status = itemStatus(item, now, odometerNow);
    if (status !== was) {
      statusChanges.push({ kind: item.kind, label: BASELINE_INTERVALS[item.kind].label, from: was, to: status });
    }
    return { ...item, status };
  });

  return {
    ok: true,
    car: { ...car, vehicle, readingAt: now.toISOString(), items },
    effect: { type: "odometer_updated", from: before, to: miles, statusChanges },
  };
}
