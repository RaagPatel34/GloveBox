import { parsePlainDate } from "./days";
import {
  BASELINE_INTERVALS,
  DAY_MS,
  estimateCarOdometer,
  isItemKind,
  isOdometerReading,
  isPlainDate,
  itemStatus,
  MAX_ODOMETER,
} from "./intervals";
import { tighterLimit } from "./limits";
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
  // The due point that limits it, as on the dashboard tile, as of when it was logged.
  next: { kind: "days"; dueAt: string } | { kind: "miles"; dueOdometer: number } | null;
};

export type OdometerUpdated = {
  type: "odometer_updated";
  // The estimate the dashboard showed before, and the reading now.
  from: number;
  to: number;
  statusChanges: { kind: ScheduleItemKind; label: string; from: ItemStatus; to: ItemStatus }[];
};

export type Result<E> = { ok: true; car: CarSnapshot; effect: E } | { ok: false; error: string };

// Services logged further back than this are almost certainly a misread date.
const MAX_DAYS_BACK = 3 * 365;

const ODOMETER_ERROR = `The odometer must be a whole number of miles up to ${MAX_ODOMETER}.`;

// "2026-10-15" or a full ISO timestamp. A bare date is pinned to noon UTC (see
// parsePlainDate). Returns an error string for anything else.
function parseServiceDate(raw: string | undefined, now: Date): Date | string {
  if (raw === undefined) return now;
  const date = isPlainDate(raw) ? parsePlainDate(raw) : new Date(raw);
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(raw) || Number.isNaN(date.getTime())) {
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
    return { ok: false, error: ODOMETER_ERROR };
  }
  const doneAt = parseServiceDate(input.date, now);
  if (typeof doneAt === "string") return { ok: false, error: doneAt };
  // An older service would move the schedule backwards. A day's slack keeps a bare date
  // (pinned to noon) for the same day as the last log from being refused.
  if (item.lastDoneAt !== undefined && doneAt.getTime() < new Date(item.lastDoneAt).getTime() - DAY_MS) {
    return { ok: false, error: "That service is older than the last one on record, so there is nothing to update." };
  }

  // Planned trips have not been driven and cannot become completed service mileage.
  const doneOdometer = input.odometer ?? estimateCarOdometer({ ...car, plannedTripMiles: 0 }, doneAt);
  const dueAt =
    item.intervalDays === undefined ? undefined : new Date(doneAt.getTime() + item.intervalDays * DAY_MS).toISOString();
  const dueOdometer = item.intervalMiles === undefined ? undefined : doneOdometer + item.intervalMiles;
  // A mileage past today's estimate is a newer reading: the car has at least that many
  // miles now. It becomes the reading, and every status is recomputed, as updateOdometer does.
  const moved = input.odometer !== undefined && input.odometer > estimateCarOdometer(car, now);
  const read: CarSnapshot = moved
    ? { ...car, vehicle: { ...car.vehicle, odometer: doneOdometer }, readingAt: doneAt.toISOString() }
    : car;
  const odometerNow = estimateCarOdometer(read, now);

  const updated: ScheduleItem = {
    ...item,
    lastDoneAt: doneAt.toISOString(),
    lastDoneOdometer: doneOdometer,
    dueAt,
    dueOdometer,
    status: itemStatus({ dueAt, dueOdometer }, now, odometerNow),
  };
  const items = car.items.map((i) =>
    i.id === item.id ? updated : moved ? { ...i, status: itemStatus(i, now, odometerNow) } : i,
  );
  const limit = tighterLimit(updated, now, odometerNow, read.vehicle.weeklyMiles);

  return {
    ok: true,
    car: { ...read, items },
    effect: {
      type: "service_logged",
      kind: item.kind,
      label: BASELINE_INTERVALS[item.kind].label,
      doneAt: updated.lastDoneAt!,
      doneOdometer,
      status: updated.status,
      next:
        limit?.kind === "days" && dueAt !== undefined
          ? { kind: "days", dueAt }
          : limit?.kind === "miles" && dueOdometer !== undefined
            ? { kind: "miles", dueOdometer }
            : null,
    },
  };
}

// A fresh reading taken now. It replaces the estimate, so every mileage-based status is
// recomputed and stored. Lower readings are allowed: this is how a wrong one gets fixed.
export function updateOdometer(car: CarSnapshot, miles: number, now: Date): Result<OdometerUpdated> {
  if (!isOdometerReading(miles)) return { ok: false, error: ODOMETER_ERROR };

  const before = estimateCarOdometer(car, now);
  const read: CarSnapshot = { ...car, vehicle: { ...car.vehicle, odometer: miles }, readingAt: now.toISOString() };
  const odometerNow = estimateCarOdometer(read, now);

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
    car: { ...read, items },
    effect: { type: "odometer_updated", from: before, to: miles, statusChanges },
  };
}
