import { parseRoute, type RouteResult } from "./route-planner";
import type { LatLng } from "./types";

// Google Places (New) and Routes for the trip agent. Server-only: the key is the server
// key. Parsing is strict: anything unusable is "not found" or an error, never a guess.

export type Place = LatLng & { name: string; label: string };

// A free-text stop -> the first matching place, or null when Google finds none.
export function parsePlace(body: unknown): Place | null {
  const place = (body as {
    places?: { formattedAddress?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } }[];
  })?.places?.[0];
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  const label = place?.formattedAddress?.trim();
  if (!label || typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { name: place?.displayName?.text?.trim() || label, label, lat, lng };
}

const waypoint = ({ lat, lng }: LatLng) => ({ location: { latLng: { latitude: lat, longitude: lng } } });

// Home -> every stop -> home. Routes reorders the stops only when there are two or more:
// for one it answers with order [-1].
export function loopRouteRequest(home: LatLng, stops: LatLng[]) {
  return {
    origin: waypoint(home),
    destination: waypoint(home),
    intermediates: stops.map(waypoint),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    optimizeWaypointOrder: stops.length >= 2,
    units: "IMPERIAL",
  };
}

// Biased toward points within about 30 miles of `near` (not limited to them), so "Trader Joe's" means one close to home.
export async function findPlace(apiKey: string, query: string, near?: LatLng): Promise<Place | null> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: "US",
      pageSize: 1,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } } } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Places responded ${response.status}`);
  return parsePlace(await response.json());
}

export async function computeLoopRoute<T extends LatLng>(apiKey: string, home: LatLng, stops: T[]): Promise<RouteResult<T>> {
  const request = loopRouteRequest(home, stops);
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Routes responded ${response.status}`);
  return parseRoute(await response.json(), stops, request.optimizeWaypointOrder);
}
