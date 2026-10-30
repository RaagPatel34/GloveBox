import { planTrip, tripTiers } from "@/lib/agent/trip";
import { missingNebiusConfig, nebiusChat } from "@/lib/nebius";
import { boundedJson, sameOrigin } from "@/lib/request-json";
import { tripServices } from "@/lib/trip-services";
import type { TripReply } from "@/lib/types";

// The trip panel: POST { stops, home, mpg } -> TripReply. The car lives in the browser,
// so its home and MPG come with the request. The logic lives in src/lib/agent/trip.ts.
export async function POST(request: Request) {
  const answer = (message: string, status: number) => Response.json({ model: null, message, plan: null } satisfies TripReply, { status });
  if (!sameOrigin(request)) return answer("Cross-origin requests are not accepted.", 403);
  const services = tripServices();
  if (!services) return answer("Trip planning needs Google Maps and EIA prices, which aren't connected yet. You can still plan the drive by hand below.", 503);

  let body: Record<string, unknown>;
  try {
    const parsed = await boundedJson(request);
    if (typeof parsed !== "object" || parsed === null) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return answer("Send the trip as JSON: { stops, home, mpg }.", 400);
  }
  const home = body.home as Record<string, unknown> | undefined;
  if (
    typeof home?.label !== "string" || !home.label.trim() || home.label.length > 200 ||
    typeof home.lat !== "number" || typeof home.lng !== "number" ||
    !Number.isFinite(home.lat) || !Number.isFinite(home.lng) || Math.abs(home.lat) > 90 || Math.abs(home.lng) > 180
  ) {
    return answer("Set your home location in Car & settings, then plan again.", 400);
  }

  // A trip with a gas stop may run on Ultra (choosing between stations), so it needs Ultra too.
  const missing = missingNebiusConfig(tripTiers(body.stops));
  if (missing.length > 0) console.warn(`Trip agent is offline: ${missing.join(", ")} not set`);

  const reply = await planTrip({
    stops: body.stops,
    home: { label: home.label.trim(), lat: home.lat, lng: home.lng },
    mpg: typeof body.mpg === "number" ? body.mpg : NaN,
    chat: process.env.ENABLE_LIVE_AI === "true" && missing.length === 0 ? nebiusChat() : null,
    services,
  });
  return Response.json(reply);
}
