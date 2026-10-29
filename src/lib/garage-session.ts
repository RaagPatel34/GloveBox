import type { Garage } from "./maintenance";

// The garage this tab holds, plus the one a demo reset replaced. Pure, so the rules for
// what Undo restores are tested once; GarageProvider stores and persists the result.
export type GarageSession = { garage: Garage | null; beforeReset: Garage | null };

// Any save other than a reset ends the chance to undo it: restoring the old garage then
// would silently discard what was just saved.
export function garageSaved(_session: GarageSession, next: Garage): GarageSession {
  return { garage: next, beforeReset: null };
}

// A change worked out from the garage as it is when it lands, so a slow request (a live
// drive review) never overwrites what changed while it was running.
export function garageUpdated(session: GarageSession, change: (garage: Garage) => Garage): GarageSession {
  if (!session.garage) return session;
  return garageSaved(session, change(session.garage));
}

export function resetToDemo(session: GarageSession, demo: Garage): GarageSession {
  return { garage: demo, beforeReset: session.garage };
}

export function undoReset(session: GarageSession): GarageSession {
  if (!session.beforeReset) return session;
  return { garage: session.beforeReset, beforeReset: null };
}
