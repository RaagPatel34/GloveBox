import { pacificDate } from "./agent/router";
import { estimateCarOdometer, isOdometerReading, isPlainDate } from "./intervals";
import { numberFormat } from "./readout";
import type { CarSnapshot, DueTarget, Proposal, ScheduleItemKind } from "./types";

// Proposals: schedule changes the maintenance agent suggests for a life event. Making one
// never touches the car; only the user's Apply does. Pure, so the rules are tested
// without a model or a database.

export type ProposalResult = { ok: true; proposal: Proposal } | { ok: false; error: string };

// The item's due target as stored, with absent fields left out.
function dueTarget(item: DueTarget): DueTarget {
  return {
    ...(item.dueAt === undefined ? {} : { dueAt: item.dueAt }),
    ...(item.dueOdometer === undefined ? {} : { dueOdometer: item.dueOdometer }),
  };
}

// A proposal to move one item's due date and/or mileage. `from` is read from the car,
// never from the model, so the card shows what the schedule says today.
//
// The new due point must be one the item tracks, and a real move: from tomorrow up to one
// interval ahead, or from today's estimated odometer up to one interval on. A due date is
// a calendar day ("2026-10-25"); like a logged service's, it is pinned to noon UTC, which
// is the same day in California.
export function proposeAdjustment(
  car: CarSnapshot,
  input: { kind: ScheduleItemKind; dueAt?: string; dueOdometer?: number; reason: string },
  now: Date,
  newId: () => string,
): ProposalResult {
  const refuse = (error: string): ProposalResult => ({ ok: false, error });
  const item = car.items.find((i) => i.kind === input.kind);
  if (!item) return refuse(`This car has no ${input.kind} item.`);
  if (input.dueAt === undefined && input.dueOdometer === undefined) {
    return refuse("Give newDueAt or newDueOdometer, or both.");
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason === "") return refuse("Give a reason the user can read.");

  const from = dueTarget(item);
  const to: DueTarget = { ...from };

  if (input.dueAt !== undefined) {
    if (item.intervalDays === undefined) return refuse(`${input.kind} is tracked by mileage only.`);
    const day = input.dueAt;
    // A day past the month's end rolls over, or does not parse at all: neither is the day given.
    const pinned = isPlainDate(day) ? new Date(`${day}T12:00:00.000Z`) : null;
    if (!pinned || Number.isNaN(pinned.getTime()) || pinned.toISOString().slice(0, 10) !== day) {
      return refuse(`"${String(day)}" is not a date. Use YYYY-MM-DD.`);
    }
    const earliest = pacificDate(now, -1);
    const latest = pacificDate(now, -item.intervalDays);
    if (day < earliest || day > latest) return refuse(`The new due date must be from ${earliest} to ${latest}.`);
    to.dueAt = `${day}T12:00:00.000Z`;
  }

  if (input.dueOdometer !== undefined) {
    if (item.intervalMiles === undefined) return refuse(`${input.kind} is tracked by date only.`);
    if (!isOdometerReading(input.dueOdometer)) return refuse("The new due mileage must be whole miles.");
    const lowest = estimateCarOdometer(car, now);
    const highest = lowest + item.intervalMiles;
    if (input.dueOdometer < lowest || input.dueOdometer > highest) {
      return refuse(
        `The new due mileage must be from ${numberFormat.format(lowest)} to ${numberFormat.format(highest)} mi.`,
      );
    }
    to.dueOdometer = input.dueOdometer;
  }

  if (to.dueAt === from.dueAt && to.dueOdometer === from.dueOdometer) {
    return refuse(`${input.kind} is already due then. Propose a change, or skip it.`);
  }

  return {
    ok: true,
    proposal: {
      id: newId(),
      vehicleId: car.vehicle.id,
      itemId: item.id,
      from,
      to,
      reason,
      model: "super",
      state: "pending",
    },
  };
}
