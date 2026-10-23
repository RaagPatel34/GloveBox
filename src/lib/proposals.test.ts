import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";
import { decideProposal, proposeAdjustment } from "./proposals";
import { logService } from "./service-log";
import { inDays, NOW } from "./test-support";
import type { CarSnapshot } from "./types";

const VISITOR = "11111111-2222-4333-8444-555555555555";
const car = demoCar(NOW, VISITOR, randomUUID);
const REASON = "Dirt roads coat the car in dust.";

const propose = (input: { kind: string; dueAt?: string; dueOdometer?: number; reason?: string }) =>
  proposeAdjustment(car, { reason: REASON, ...input } as Parameters<typeof proposeAdjustment>[1], NOW, randomUUID);

describe("proposeAdjustment", () => {
  it("moves a due date to noon UTC on the day given, keeping the rest of the due target", () => {
    const result = propose({ kind: "oil", dueAt: "2026-10-25" });
    if (!result.ok) throw new Error(result.error);
    expect(result.proposal.from).toEqual({ dueAt: inDays(65), dueOdometer: 48_400 });
    expect(result.proposal.to).toEqual({ dueAt: "2026-10-25T12:00:00.000Z", dueOdometer: 48_400 });
  });

  it("takes from tomorrow and from today's odometer, up to the due point the item has now", () => {
    // Today is 2026-10-22 in California; the demo car is at about 48,000 mi. Oil is due
    // 2026-12-26 or at 48,400 mi.
    expect(propose({ kind: "oil", dueAt: "2026-10-23" }).ok).toBe(true);
    expect(propose({ kind: "oil", dueAt: "2026-12-25" }).ok).toBe(true);
    expect(propose({ kind: "oil", dueOdometer: 48_000 }).ok).toBe(true);
    expect(propose({ kind: "oil", dueOdometer: 48_399 }).ok).toBe(true);
  });

  it("takes up to one interval ahead for an item with no due point yet", () => {
    const unset = { ...car, items: car.items.map((i) => (i.kind === "oil" ? { ...i, dueAt: undefined, dueOdometer: undefined } : i)) };
    const proposeUnset = (input: { dueAt?: string; dueOdometer?: number }) =>
      proposeAdjustment(unset, { kind: "oil", reason: REASON, ...input }, NOW, randomUUID);
    expect(proposeUnset({ dueAt: "2027-10-22" }).ok).toBe(true);
    expect(proposeUnset({ dueOdometer: 55_500 }).ok).toBe(true);
    expect(proposeUnset({ dueAt: "2027-10-23" }).ok).toBe(false);
    expect(proposeUnset({ dueOdometer: 55_501 }).ok).toBe(false);
  });

  it.each([
    ["a later date", { kind: "oil", dueAt: "2026-12-27" }, /only move sooner.*2026-12-26/],
    ["a later mileage", { kind: "oil", dueOdometer: 48_401 }, /only move sooner.*48,400 mi/],
    ["a later mileage with a sooner date", { kind: "oil", dueAt: "2026-11-01", dueOdometer: 49_000 }, /only move sooner/],
  ])("refuses %s: a life event adds wear, so it never pushes a due point back", (_label, input, error) => {
    const result = propose(input);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(error) });
  });

  it.each([
    ["an item the car does not have", { kind: "sunroof", dueAt: "2026-11-01" }, /no sunroof/],
    ["no new due date or mileage", { kind: "oil" }, /newDueAt or newDueOdometer/],
    ["the due point it already has", { kind: "oil", dueOdometer: 48_400 }, /already/],
    ["a mileage for an item tracked by date only", { kind: "wash", dueOdometer: 48_500 }, /by date/],
    ["a date for an item tracked by mileage only", { kind: "engine_filter", dueAt: "2026-11-01" }, /by mileage/],
    ["a mileage the car has already passed", { kind: "oil", dueOdometer: 47_999 }, /48,000/],
    ["a mileage more than one interval on", { kind: "oil", dueOdometer: 55_501 }, /55,500/],
    ["a mileage that is not whole miles", { kind: "oil", dueOdometer: 48_100.5 }, /whole/],
    ["a mileage as text", { kind: "oil", dueOdometer: "48100" }, /whole/],
    ["today", { kind: "oil", dueAt: "2026-10-22" }, /2026-10-23/],
    ["a date in the past", { kind: "oil", dueAt: "2026-10-01" }, /2026-10-23/],
    ["a date more than one interval ahead", { kind: "oil", dueAt: "2027-10-23" }, /2027-10-22/],
    ["a date not written YYYY-MM-DD", { kind: "oil", dueAt: "10/25/2026" }, /YYYY-MM-DD/],
    ["a day that does not exist", { kind: "oil", dueAt: "2026-11-31" }, /YYYY-MM-DD/],
    ["a month that does not exist", { kind: "oil", dueAt: "2026-13-01" }, /YYYY-MM-DD/],
    ["no reason", { kind: "oil", dueOdometer: 48_100, reason: "  " }, /reason/],
  ])("refuses %s", (_label, input, error) => {
    const result = propose(input as Parameters<typeof propose>[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });

  it("refuses the day an item is already due, whatever time of day it was stored at", () => {
    // Logged in the afternoon, the wash is due at 18:34 UTC on Nov 5, not at noon.
    const afternoon = new Date("2026-10-22T18:34:00.000Z");
    const logged = logService(car, { kind: "wash" }, afternoon);
    if (!logged.ok) throw new Error(logged.error);
    expect(logged.car.items.find((i) => i.kind === "wash")!.dueAt).toBe("2026-11-05T18:34:00.000Z");

    const result = proposeAdjustment(logged.car, { kind: "wash", dueAt: "2026-11-05", reason: REASON }, afternoon, randomUUID);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/already/) });
  });
});

describe("decideProposal", () => {
  // Engine air filter: due at 49,800, so OK at 48,000. Moved to 48,300 it is due soon.
  const filterProposal = () => {
    const result = propose({ kind: "engine_filter", dueOdometer: 48_300 });
    if (!result.ok) throw new Error(result.error);
    return result.proposal;
  };
  const tile = (snapshot: CarSnapshot, kind: string) => buildDashboard(snapshot, NOW).items.find((i) => i.kind === kind)!;

  it("Apply moves the item's due point, and its dashboard status follows at once", () => {
    expect(tile(car, "engine_filter").status).toBe("ok");

    const result = decideProposal(car, filterProposal(), "apply", NOW);
    if (!result.ok) throw new Error(result.error);

    expect(result.proposal.state).toBe("applied");
    const filter = result.car!.items.find((i) => i.kind === "engine_filter")!;
    expect(filter).toMatchObject({ dueOdometer: 48_300, status: "due_soon" });
    expect(tile(result.car!, "engine_filter")).toMatchObject({
      status: "due_soon",
      limit: { kind: "miles", remaining: 300 },
    });
    // Nothing else moves.
    expect(result.car!.items.filter((i) => i.kind !== "engine_filter")).toEqual(
      car.items.filter((i) => i.kind !== "engine_filter"),
    );
  });

  it("Dismiss drops the proposal and leaves the car as it was", () => {
    const result = decideProposal(car, filterProposal(), "dismiss", NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.proposal.state).toBe("dismissed");
    expect(result.car).toBeNull();
  });

  it.each(["applied", "dismissed"] as const)("refuses to decide a proposal that is already %s", (state) => {
    const result = decideProposal(car, { ...filterProposal(), state }, "apply", NOW);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(new RegExp(state)) });
  });

  it("refuses to apply a proposal the schedule has moved on from, so a newer service is not undone", () => {
    const proposal = filterProposal();
    const logged = logService(car, { kind: "engine_filter" }, NOW);
    if (!logged.ok) throw new Error(logged.error);

    const result = decideProposal(logged.car, proposal, "apply", NOW);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/changed since/) });
    // It can still be dismissed.
    expect(decideProposal(logged.car, proposal, "dismiss", NOW).ok).toBe(true);
  });

  it.each([
    ["a due date that has since passed", { kind: "oil", dueAt: "2026-10-25" }],
    ["a due mileage the car has since driven past", { kind: "oil", dueOdometer: 48_000 }],
  ])("refuses to apply %s, so Apply never sets a due point in the past", (_label, input) => {
    const made = propose(input);
    if (!made.ok) throw new Error(made.error);
    // A week later: Oct 29, and about 48,250 mi.
    const weekLater = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = decideProposal(car, made.proposal, "apply", weekLater);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/out of date.*Dismiss/) });
    expect(decideProposal(car, made.proposal, "dismiss", weekLater).ok).toBe(true);
  });

  it("applies a proposal whose due date was read on the same day the item is due", () => {
    // The card was made from a due date of noon; the item is stored at 18:34 the same day.
    const proposal = { ...filterProposal(), from: { dueAt: "2026-11-05T12:00:00.000Z" }, to: { dueAt: "2026-11-01T12:00:00.000Z" } };
    const wash = car.items.find((i) => i.kind === "wash")!;
    const later = { ...car, items: car.items.map((i) => (i === wash ? { ...i, dueAt: "2026-11-05T18:34:00.000Z" } : i)) };

    const result = decideProposal(later, { ...proposal, itemId: wash.id }, "apply", NOW);
    expect(result.ok).toBe(true);
  });

  it("refuses a proposal for another car's item", () => {
    const result = decideProposal(car, { ...filterProposal(), itemId: "someone-else" }, "apply", NOW);
    expect(result.ok).toBe(false);
  });
});
