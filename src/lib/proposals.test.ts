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

  it("takes from tomorrow up to one interval ahead, and from today's odometer up to one interval on", () => {
    // Today is 2026-10-22 in California; the demo car is at about 48,000 mi.
    expect(propose({ kind: "oil", dueAt: "2026-10-23" }).ok).toBe(true);
    expect(propose({ kind: "oil", dueAt: "2027-10-22" }).ok).toBe(true);
    expect(propose({ kind: "oil", dueOdometer: 48_000 }).ok).toBe(true);
    expect(propose({ kind: "oil", dueOdometer: 55_500 }).ok).toBe(true);
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

  it("refuses a proposal for another car's item", () => {
    const result = decideProposal(car, { ...filterProposal(), itemId: "someone-else" }, "apply", NOW);
    expect(result.ok).toBe(false);
  });
});
