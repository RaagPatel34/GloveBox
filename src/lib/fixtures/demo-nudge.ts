import { checkConditions } from "../nudge-check";
import type { CarSnapshot, Nudge } from "../types";
import type { FetchLike } from "../weather";

// The demo car's pending nudge, from the real current forecast at its home (Buena Park):
// rain-hold, a dry window to wash in, or a smoke warning, whichever the weather and air
// call for. The demo wash is overdue, so a successful check always has something to say.
//
// If Open-Meteo cannot be reached, "Load demo car" must still work and must not pretend: the
// nudge says it is a placeholder because the check failed, never a made-up forecast. A check
// that worked but found nothing to say seeds no nudge at all (null).
// Returns a Nudge for the demo car, built the way the daily job's will be.
export async function demoNudge(
  car: CarSnapshot,
  now: Date,
  newId: () => string,
  fetchImpl?: FetchLike,
): Promise<Nudge | null> {
  const { nudge, complete } = await checkConditions(car, now, fetchImpl);
  const draft =
    nudge ??
    (complete
      ? null
      : {
          text: "Check the forecast before you wash.",
          reason:
            "Open-Meteo could not be reached or read when the demo car loaded, so this is not a real forecast. Load the demo car again to retry.",
        });
  return draft && { id: newId(), vehicleId: car.vehicle.id, createdAt: now.toISOString(), ...draft };
}
