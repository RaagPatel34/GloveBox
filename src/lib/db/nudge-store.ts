import { nudgeCutoff } from "../nudge";
import { nudgeFromRow, nudgeToRow, type NudgeDriverRow, type NudgeRow } from "../nudge-rows";
import type { Nudge } from "../types";
import { isVisitorId } from "../visitor";
import { getSql } from "./sql";

// Postgres access for nudges. Kept thin: the interesting logic is in nudge.ts and nudge-rows.ts.

// The visitor's current nudges, newest first: those made within NUDGE_TTL_MS of `now`.
// Joined through the vehicle so a visitor only ever reads their own.
export async function listNudges(visitorId: string, now: Date): Promise<Nudge[]> {
  if (!isVisitorId(visitorId)) return [];
  const sql = getSql();
  const since = nudgeCutoff(now).toISOString();
  const rows = (await sql`
    SELECT n.* FROM nudges n JOIN vehicles v ON v.id = n.vehicle_id
    WHERE v.visitor_id = ${visitorId} AND n.created_at > ${since}
    ORDER BY n.created_at DESC`) as NudgeDriverRow[];
  return rows.map(nudgeFromRow);
}

// Stores a nudge for a car, as that car's one current nudge: the car's earlier nudges are
// replaced (two forecasts within 36 hours would otherwise disagree on screen), and every
// expired nudge is deleted along the way, so the table does not grow. This is what the daily
// job (#16) calls; scheduling that job is #16's work.
export async function addNudge(nudge: Nudge): Promise<void> {
  const sql = getSql();
  const row: NudgeRow = nudgeToRow(nudge);
  const expired = nudgeCutoff(new Date(nudge.createdAt)).toISOString();
  await sql.transaction([
    sql`DELETE FROM nudges WHERE vehicle_id = ${row.vehicle_id} OR created_at <= ${expired}`,
    sql`INSERT INTO nudges (id, vehicle_id, text, reason, created_at)
        VALUES (${row.id}, ${row.vehicle_id}, ${row.text}, ${row.reason}, ${row.created_at})`,
  ]);
}
