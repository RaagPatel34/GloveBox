import { pacificDate, pacificDateAhead, parsePlainDate, sameDueDay } from "./days";
import { estimateCarOdometer, isOdometerReading, itemStatus } from "./intervals";
import { numberFormat } from "./readout";
import type { CarSnapshot, DueTarget, Proposal, ScheduleItem, ScheduleItemKind } from "./types";

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

// Where a due point that moves may land: from tomorrow up to one interval ahead, or from
// today's estimated odometer up to one interval on. Only what moves is checked. Checked
// when a proposal is made and again on Apply, as a card can wait days to be applied.
// Returns why it is outside, or null.
function outsideWindow(car: CarSnapshot, item: ScheduleItem, from: DueTarget, to: DueTarget, now: Date): string | null {
  if (to.dueAt !== undefined && !sameDueDay(to.dueAt, from.dueAt) && item.intervalDays !== undefined) {
    const day = pacificDate(new Date(to.dueAt));
    const earliest = pacificDateAhead(now, 1);
    const latest = pacificDateAhead(now, item.intervalDays);
    if (day < earliest || day > latest) return `The new due date must be from ${earliest} to ${latest}.`;
  }
  if (to.dueOdometer !== undefined && to.dueOdometer !== from.dueOdometer && item.intervalMiles !== undefined) {
    const lowest = estimateCarOdometer(car, now);
    const highest = lowest + item.intervalMiles;
    if (to.dueOdometer < lowest || to.dueOdometer > highest) {
      return `The new due mileage must be from ${numberFormat.format(lowest)} to ${numberFormat.format(highest)} mi.`;
    }
  }
  return null;
}

// The rule Super is told in the tool description, and again when it breaks it.
export const SOONER = "Life events add wear, so a due point can only move sooner, never later.";

// A proposal to move one item's due date and/or mileage. `from` is read from the car,
// never from the model, so the card shows what the schedule says today.
//
// The new due point must be one the item tracks, and a real move: from tomorrow up to one
// interval ahead, or from today's estimated odometer up to one interval on. It must also
// be no later than the item's current due point (see SOONER). A due date is a calendar
// day ("2026-10-25"); like a logged service's, it is pinned to noon UTC (see parsePlainDate).
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
    const pinned = parsePlainDate(input.dueAt);
    if (!pinned) return refuse(`"${String(input.dueAt)}" is not a date. Use YYYY-MM-DD.`);
    // The day it is already due keeps its stored time, so it is not shown as a move.
    to.dueAt = sameDueDay(pinned.toISOString(), from.dueAt) ? from.dueAt : pinned.toISOString();
  }

  if (input.dueOdometer !== undefined) {
    if (item.intervalMiles === undefined) return refuse(`${input.kind} is tracked by date only.`);
    if (!isOdometerReading(input.dueOdometer)) return refuse("The new due mileage must be whole miles.");
    to.dueOdometer = input.dueOdometer;
  }

  const outside = outsideWindow(car, item, from, to, now);
  if (outside) return refuse(outside);

  if (from.dueAt !== undefined && to.dueAt !== undefined && pacificDate(new Date(to.dueAt)) > pacificDate(new Date(from.dueAt))) {
    return refuse(`${SOONER} ${input.kind} is due ${pacificDate(new Date(from.dueAt))} now: give an earlier date, or skip it.`);
  }
  if (from.dueOdometer !== undefined && to.dueOdometer !== undefined && to.dueOdometer > from.dueOdometer) {
    return refuse(
      `${SOONER} ${input.kind} is due at ${numberFormat.format(from.dueOdometer)} mi now: give a lower mileage, or skip it.`,
    );
  }

  if (sameDueDay(to.dueAt, from.dueAt) && to.dueOdometer === from.dueOdometer) {
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

export type Decision = "apply" | "dismiss" | "hide";

export const CHANGED_SINCE = "Your schedule for this item changed since this was suggested. Dismiss it instead.";

export type DecisionResult =
  | { ok: true; decision: Decision; proposal: Proposal; car: CarSnapshot | null }
  | { ok: false; error: string };

// A decision that can be saved.
export type Decided = Extract<DecisionResult, { ok: true }>;

// The user's Apply, Dismiss or Hide on a card. Apply returns the car with the item moved
// to `to` and its status recomputed, so the dashboard shows the change at once; Dismiss
// and Hide return no car, as nothing on it changes.
//
// A proposal is made against the schedule as it was then. If the item has moved since (a
// service logged, another proposal applied), applying it would undo that, so it is refused.
// So is one whose new due point has passed while the card waited.
//
// Only a pending card is applied or dismissed. Only an applied one is hidden: it stays
// applied in the database, so the change it made is still on record.
export function decideProposal(car: CarSnapshot, proposal: Proposal, decision: Decision, now: Date): DecisionResult {
  if (decision === "hide") {
    if (proposal.state !== "applied" || proposal.hiddenAt !== undefined) {
      return { ok: false, error: "Only a suggestion you applied can be hidden." };
    }
    return { ok: true, decision, proposal: { ...proposal, hiddenAt: now.toISOString() }, car: null };
  }
  if (proposal.state !== "pending") return { ok: false, error: `That suggestion was already ${proposal.state}.` };
  if (decision === "dismiss") return { ok: true, decision, proposal: { ...proposal, state: "dismissed" }, car: null };

  const item = car.items.find((i) => i.id === proposal.itemId);
  if (!item) return { ok: false, error: "That item is no longer on your car." };
  if (!sameDueDay(item.dueAt, proposal.from.dueAt) || item.dueOdometer !== proposal.from.dueOdometer) {
    return { ok: false, error: CHANGED_SINCE };
  }
  if (outsideWindow(car, item, proposal.from, proposal.to, now)) {
    return { ok: false, error: "This suggestion is out of date: its new due point has already passed. Dismiss it instead." };
  }

  const moved = { ...item, dueAt: proposal.to.dueAt, dueOdometer: proposal.to.dueOdometer };
  moved.status = itemStatus(moved, now, estimateCarOdometer(car, now));
  return {
    ok: true,
    decision,
    proposal: { ...proposal, state: "applied" },
    car: { ...car, items: car.items.map((i) => (i.id === item.id ? moved : i)) },
  };
}
