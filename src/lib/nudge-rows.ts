import type { Nudge } from "./types";

// Mapping between a Nudge and its row in the `nudges` table (see src/lib/db/schema.ts).
// Pure, so it is tested without a database. The neon driver returns timestamptz as a Date.

export type NudgeRow = {
  id: string;
  vehicle_id: string;
  text: string;
  reason: string;
  created_at: string;
};

export function nudgeToRow(nudge: Nudge): NudgeRow {
  return {
    id: nudge.id,
    vehicle_id: nudge.vehicleId,
    text: nudge.text,
    reason: nudge.reason,
    created_at: nudge.createdAt,
  };
}

export type NudgeDriverRow = Omit<NudgeRow, "created_at"> & { created_at: string | Date };

export function nudgeFromRow(row: NudgeDriverRow): Nudge {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    text: row.text,
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
