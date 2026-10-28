import { proposalFromRow, proposalToRow, type ProposalRow } from "../proposal-rows";
import type { Decided } from "../proposals";
import type { Proposal } from "../types";
import { isVisitorId } from "../visitor";
import { getSql } from "./sql";

// Postgres access for the visitor's proposal cards. Kept thin, like car-store.ts: the rules
// are in proposals.ts. Every query is scoped to the visitor's own vehicle.
//
// For the reads, as in car-store.ts, the caller validates the visitor ID (getCarSnapshot
// does); a malformed one just finds no row. The writes check it themselves.

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
  const sql = getSql();
  const rows = (await sql`SELECT p.* FROM proposals p JOIN vehicles v ON v.id = p.vehicle_id
    WHERE v.visitor_id = ${visitorId} AND p.id = ${proposalId}`) as ProposalRow[];
  return rows.length === 0 ? null : proposalFromRow(rows[0]);
}

// Adds new proposals, all or none. A missing or unowned vehicle/item rejects the whole batch.
// A new proposal replaces any card still pending for the same item: that one is dismissed in
// the same transaction, so there is never more than one card waiting per item.
export async function addProposals(visitorId: string, proposals: Proposal[]): Promise<void> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  if (proposals.length === 0) return;
  const sql = getSql();
  // Lock all affected items before replacement, in a stable order across batches.
  // A second request waits here and its following UPDATE sees the first request's INSERT.
  const itemIds = [...new Set(proposals.map(proposal => proposal.itemId))].sort();
  await sql.transaction([
    sql`SELECT s.id FROM schedule_items s JOIN vehicles v ON v.id = s.vehicle_id
      WHERE v.visitor_id = ${visitorId} AND s.id = ANY(${itemIds}::text[])
      ORDER BY s.id FOR UPDATE OF s`,
    ...proposals.flatMap((proposal) => {
      const row = proposalToRow(proposal);
      return [
        sql`UPDATE proposals SET state = 'dismissed'
          WHERE item_id = ${row.item_id} AND state = 'pending'
            AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${row.vehicle_id} AND visitor_id = ${visitorId})`,
        sql`INSERT INTO proposals (id, vehicle_id, item_id, from_due_at, from_due_odometer, to_due_at,
            to_due_odometer, reason, model, state)
          VALUES (${row.id},
            (SELECT v.id FROM vehicles v JOIN schedule_items s ON s.vehicle_id = v.id
              WHERE v.id = ${row.vehicle_id} AND v.visitor_id = ${visitorId} AND s.id = ${row.item_id}),
            ${row.item_id}, ${row.from_due_at}, ${row.from_due_odometer},
            ${row.to_due_at}, ${row.to_due_odometer}, ${row.reason}, ${row.model}, ${row.state})`,
      ];
    }),
  ]);
}

// Records the user's decision on a card (see decideProposal). Only a still-pending card is
// applied or dismissed. Returns false if nothing changed:
// a second click, one from another tab, or, for Apply, an item that moved since.
//
// Apply moves the item and marks the card in one statement, so the card and the schedule
// never disagree. The item moves only if its due point is still the card's `from`: the
// check in decideProposal ran on rows read before this write, and a service logged or
// another card applied in between must not be overwritten.
export async function saveDecision(visitorId: string, decided: Decided): Promise<boolean> {
  if (!isVisitorId(visitorId)) throw new Error("Invalid visitor ID");
  const sql = getSql();
  const { proposal } = decided;
  let rows: unknown[];

  if (decided.decision === "dismiss") {
    rows = await sql`UPDATE proposals SET state = 'dismissed'
        WHERE id = ${proposal.id} AND state = 'pending'
          AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${proposal.vehicleId} AND visitor_id = ${visitorId})
        RETURNING id`;
  } else {
    const item = decided.car?.items.find((i) => i.id === proposal.itemId);
    if (!item) return false;
    const from = proposalToRow(proposal);
    rows = await sql`WITH owned_item AS (
          SELECT s.id FROM schedule_items s JOIN vehicles v ON v.id = s.vehicle_id
          WHERE s.id = ${item.id} AND v.visitor_id = ${visitorId}
          FOR UPDATE OF s
        ), eligible AS (
          SELECT p.id FROM proposals p JOIN vehicles v ON v.id = p.vehicle_id
          WHERE p.id = ${proposal.id} AND p.item_id = ${item.id}
            AND p.state = 'pending' AND v.visitor_id = ${visitorId}
            AND EXISTS (SELECT 1 FROM owned_item)
          FOR UPDATE OF p
        ), moved AS (
          UPDATE schedule_items SET due_at = ${item.dueAt ?? null}, due_odometer = ${item.dueOdometer ?? null},
            status = ${item.status}
          WHERE id = ${item.id}
            AND vehicle_id = (SELECT id FROM vehicles WHERE id = ${proposal.vehicleId} AND visitor_id = ${visitorId})
            AND due_at IS NOT DISTINCT FROM ${from.from_due_at}::timestamptz
            AND due_odometer IS NOT DISTINCT FROM ${from.from_due_odometer}::integer
            AND EXISTS (SELECT 1 FROM eligible)
          RETURNING id
        )
        , cleared_nudges AS (
          DELETE FROM nudges WHERE vehicle_id = ${proposal.vehicleId}
            AND ${item.kind} = 'wash' AND EXISTS (SELECT 1 FROM moved)
        )
        UPDATE proposals SET state = 'applied'
        WHERE id = ${proposal.id} AND state = 'pending' AND EXISTS (SELECT 1 FROM moved)
        RETURNING id`;
  }
  return rows.length > 0;
}
