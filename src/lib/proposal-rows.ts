import type { DueTarget, ModelTier, Proposal } from "./types";

// Mapping between a Proposal and its flat row in Postgres (see src/lib/db/schema.ts).
// Pure, so it is tested without a database. Lenient about what the driver returns, as
// car-rows.ts is: timestamptz comes back as a Date, numerics may come back as strings.

export type ProposalRow = {
  id: string;
  vehicle_id: string;
  item_id: string;
  from_due_at: string | null;
  from_due_odometer: number | null;
  to_due_at: string | null;
  to_due_odometer: number | null;
  reason: string;
  model: string;
  state: string;
};

type DriverProposalRow = Omit<ProposalRow, "from_due_at" | "to_due_at" | "from_due_odometer" | "to_due_odometer"> & {
  from_due_at: string | Date | null;
  to_due_at: string | Date | null;
  from_due_odometer: number | string | null;
  to_due_odometer: number | string | null;
};

export function proposalToRow(proposal: Proposal): ProposalRow {
  return {
    id: proposal.id,
    vehicle_id: proposal.vehicleId,
    item_id: proposal.itemId,
    from_due_at: proposal.from.dueAt ?? null,
    from_due_odometer: proposal.from.dueOdometer ?? null,
    to_due_at: proposal.to.dueAt ?? null,
    to_due_odometer: proposal.to.dueOdometer ?? null,
    reason: proposal.reason,
    model: proposal.model,
    state: proposal.state,
  };
}

function target(dueAt: string | Date | null, dueOdometer: number | string | null): DueTarget {
  return {
    ...(dueAt === null ? {} : { dueAt: new Date(dueAt).toISOString() }),
    ...(dueOdometer === null ? {} : { dueOdometer: Number(dueOdometer) }),
  };
}

export function proposalFromRow(row: DriverProposalRow): Proposal {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    itemId: row.item_id,
    from: target(row.from_due_at, row.from_due_odometer),
    to: target(row.to_due_at, row.to_due_odometer),
    reason: row.reason,
    model: row.model as ModelTier,
    state: row.state as Proposal["state"],
  };
}
