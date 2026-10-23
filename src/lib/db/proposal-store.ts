import { toRows } from "../car-rows";
import { proposalFromRow, proposalToRow, type ProposalRow } from "../proposal-rows";
import type { CarSnapshot, Proposal } from "../types";
import { isVisitorId } from "../visitor";
import { getSql } from "./sql";

// Postgres access for the visitor's proposal cards. Kept thin, like car-store.ts: the rules
// are in proposals.ts. Every query is scoped to the visitor's own vehicle.

// The cards to show: pending and applied, in the order they were made. Dismissed ones are gone.
export async function loadProposals(visitorId: string): Promise<Proposal[]> {
  if (!isVisitorId(visitorId)) return [];
  const sql = getSql();
  const rows = (await sql`SELECT p.* FROM proposals p JOIN vehicles v ON v.id = p.vehicle_id
    WHERE v.visitor_id = ${visitorId} AND p.state <> 'dismissed'
    ORDER BY p.created_at`) as ProposalRow[];
  return rows.map(proposalFromRow);
}

export async function loadProposal(visitorId: string, proposalId: string): Promise<Proposal | null> {
  if (!isVisitorId(visitorId)) return null;
  const sql = getSql();
  const rows = (await sql`SELECT p.* FROM proposals p JOIN vehicles v ON v.id = p.vehicle_id
    WHERE v.visitor_id = ${visitorId} AND p.id = ${proposalId}`) as ProposalRow[];
  return rows.length === 0 ? null : proposalFromRow(rows[0]);
}

// Adds new proposals, all or none. A proposal for a vehicle the visitor does not own is skipped.
export async function addProposals(visitorId: string, proposals: Proposal[]): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  if (proposals.length === 0) return;
  const sql = getSql();
  await sql.transaction(
    proposals.map((proposal) => {
      const row = proposalToRow(proposal);
      return sql`INSERT INTO proposals (id, vehicle_id, item_id, from_due_at, from_due_odometer, to_due_at,
          to_due_odometer, reason, model, state)
        SELECT ${row.id}, ${row.vehicle_id}, ${row.item_id}, ${row.from_due_at}, ${row.from_due_odometer},
          ${row.to_due_at}, ${row.to_due_odometer}, ${row.reason}, ${row.model}, ${row.state}
        WHERE EXISTS (SELECT 1 FROM vehicles WHERE id = ${row.vehicle_id} AND visitor_id = ${visitorId})`;
    }),
  );
}

// Records the user's decision on a pending proposal. For Apply, `car` is the car with the
// item moved (see decideProposal), and the item's due fields are written in the same
// transaction, so the card and the schedule never disagree. Only a still-pending proposal
// changes anything: a second click, or one from another tab, is a no-op.
export async function saveDecision(visitorId: string, proposal: Proposal, car: CarSnapshot | null): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const item = car && toRows(visitorId, car).items.find((i) => i.id === proposal.itemId);

  await sql.transaction([
    ...(item
      ? [
          sql`UPDATE schedule_items SET due_at = ${item.due_at}, due_odometer = ${item.due_odometer}, status = ${item.status}
              WHERE id = ${item.id}
                AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${proposal.vehicleId} AND visitor_id = ${visitorId})
                AND EXISTS (SELECT 1 FROM proposals WHERE id = ${proposal.id} AND state = 'pending')`,
        ]
      : []),
    sql`UPDATE proposals SET state = ${proposal.state}
        WHERE id = ${proposal.id} AND state = 'pending'
          AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${proposal.vehicleId} AND visitor_id = ${visitorId})`,
  ]);
}
