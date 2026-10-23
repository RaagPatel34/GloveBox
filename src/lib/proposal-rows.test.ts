import { describe, expect, it } from "vitest";
import { proposalFromRow, proposalToRow } from "./proposal-rows";
import type { Proposal } from "./types";

const proposal: Proposal = {
  id: "p1",
  vehicleId: "v1",
  itemId: "i1",
  from: { dueAt: "2026-12-26T12:00:00.000Z", dueOdometer: 48_400 },
  to: { dueAt: "2026-12-26T12:00:00.000Z", dueOdometer: 48_000 },
  reason: "Change the oil before 300 dusty miles.",
  model: "super",
  state: "pending",
};

describe("proposal rows", () => {
  it("flattens the from and to targets into columns, absent values as null", () => {
    const filter: Proposal = { ...proposal, from: { dueOdometer: 49_800 }, to: { dueOdometer: 48_300 } };
    expect(proposalToRow(filter)).toEqual({
      id: "p1",
      vehicle_id: "v1",
      item_id: "i1",
      from_due_at: null,
      from_due_odometer: 49_800,
      to_due_at: null,
      to_due_odometer: 48_300,
      reason: filter.reason,
      model: "super",
      state: "pending",
    });
  });

  it("rebuilds the same proposal that was stored", () => {
    expect(proposalFromRow(proposalToRow(proposal))).toEqual(proposal);
  });

  it("reads what the driver returns: timestamps as Date, numbers as strings", () => {
    const row = {
      ...proposalToRow(proposal),
      from_due_at: new Date(proposal.from.dueAt!),
      to_due_at: new Date(proposal.to.dueAt!),
      from_due_odometer: "48400",
      to_due_odometer: "48000",
      state: "applied",
    };
    expect(proposalFromRow(row)).toEqual({ ...proposal, state: "applied" });
  });
});
