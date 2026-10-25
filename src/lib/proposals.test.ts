import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";
import { decideProposal, proposeAdjustment } from "./proposals";
import { NOW } from "./test-support";

it("Apply changes the due point and dashboard status; Dismiss leaves the car alone", () => {
  const car = demoCar(NOW, "11111111-2222-4333-8444-555555555555", randomUUID);
  const proposed = proposeAdjustment(car, { kind: "engine_filter", dueOdometer: 48_300, reason: "Dirt roads" }, NOW, randomUUID);
  if (!proposed.ok) throw new Error(proposed.error);
  const applied = decideProposal(car, proposed.proposal, "apply", NOW);
  expect(applied.ok).toBe(true);
  if (!applied.ok || !applied.car) throw new Error("Apply failed");
  expect(applied.proposal.state).toBe("applied");
  expect(buildDashboard(applied.car, NOW).items.find(i => i.kind === "engine_filter")!.status).toBe("due_soon");
  expect(applied.car.items.find(i => i.kind === "engine_filter")!.dueOdometer).toBe(48_300);
  expect(decideProposal(car, proposed.proposal, "dismiss", NOW)).toMatchObject({ ok: true, car: null, proposal: { state: "dismissed" } });
});

it("dashboard cards show from/to, reason and model and omit dismissed cards", () => {
  const car = demoCar(NOW, "11111111-2222-4333-8444-555555555555", randomUUID);
  const proposed = proposeAdjustment(car, { kind: "engine_filter", dueOdometer: 48_300, reason: "Dirt roads" }, NOW, randomUUID);
  if (!proposed.ok) throw new Error(proposed.error);
  const dashboard = buildDashboard(car, NOW, [proposed.proposal]);
  expect(dashboard.proposals[0]).toMatchObject({ label: "Engine air filter", reason: "Dirt roads", model: "super", state: "pending" });
  expect(dashboard.proposals[0].moves).toHaveLength(1);
  expect(dashboard.proposals[0].moves[0].to).toBe("48,300 mi");
  expect(buildDashboard(car, NOW, [{ ...proposed.proposal, state: "dismissed" }]).proposals).toEqual([]);
});
