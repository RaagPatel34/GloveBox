import { parseRoute, type RouteResult } from "./route-planner";
import type { LatLng } from "./types";

// Google Places (New) and Routes for the trip agent. Server-only: the key is the server
// key. Parsing is strict: anything unusable is "not found" or an error, never a guess.

export type Place = LatLng & { name: string; label: string };

// A POST like fetch, so tests can answer Google without a network.
export type PostFetch = (url: string, init: RequestInit) => Promise<Response>;

type RawPlace = { formattedAddress?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } };

const rawPlaces = (body: unknown) => (body as { places?: RawPlace[] })?.places;

// One place Google returned, or null unless it has an address and real coordinates.
function toPlace(place: RawPlace | undefined): Place | null {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  const label = place?.formattedAddress?.trim();
  if (!label || typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { name: place?.displayName?.text?.trim() || label, label, lat, lng };
}

// A free-text stop -> the first matching place, or null when Google finds none.
export const parsePlace = (body: unknown): Place | null => toPlace(rawPlaces(body)?.[0]);

// Every usable place in a search, in Google's order.
export const parsePlaces = (body: unknown): Place[] => (rawPlaces(body) ?? []).flatMap((place) => toPlace(place) ?? []);

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

// Biased toward points within about 30 miles of `near`, and of the matches Google returns the one closest to `near`
// wins, so "Trader Joe's" means the one close to home. Never an outright refusal: a full address far from home is a
// legitimate stop.
export async function findPlace(apiKey: string, query: string, near?: LatLng, fetchImpl: PostFetch = fetch): Promise<Place | null> {
  const body = {
    textQuery: query,
    regionCode: "US",
    pageSize: near ? MAX_CANDIDATES : 1,
    ...(near ? { locationBias: biasAround(near, 50000) } : {}),
  };
  const places = parsePlaces(await searchText(apiKey, body, fetchImpl));
  return near ? closestTo(near, places) : (places[0] ?? null);
}

// Equirectangular distance squared, enough to rank places a few hundred miles apart.
function closestTo(point: LatLng, places: Place[]): Place | null {
  const flatten = Math.cos((point.lat * Math.PI) / 180);
  const apart = (place: Place) => (place.lat - point.lat) ** 2 + ((place.lng - point.lng) * flatten) ** 2;
  return places.reduce<Place | null>((best, place) => (!best || apart(place) < apart(best) ? place : best), null);
}

// The kinds of stop the user can ask for without naming a place, as Places names them.
export type StopKind = "gas" | "wash";
const KINDS = {
  gas: { textQuery: "gas station", includedType: "gas_station" },
  wash: { textQuery: "car wash", includedType: "car_wash" },
} satisfies Record<StopKind, { textQuery: string; includedType: string }>;

const MAX_CANDIDATES = 5;

const biasAround = ({ lat, lng }: LatLng, radius: number) => ({ circle: { center: { latitude: lat, longitude: lng }, radius } });

// Real gas stations or car washes: the place type is strict, so a "Gas" cafe doesn't count.
// It looks within about 5 miles of `near` (a bias, not a limit).
export function placesRequest(kind: StopKind, near: LatLng) {
  return {
    ...KINDS[kind],
    strictTypeFiltering: true,
    regionCode: "US",
    pageSize: MAX_CANDIDATES,
    locationBias: biasAround(near, 8000),
  };
}

// Candidate stops of one kind near a point, in Google's order. Empty when there are none.
export async function findPlaces(apiKey: string, kind: StopKind, near: LatLng, fetchImpl: PostFetch = fetch): Promise<Place[]> {
  return parsePlaces(await searchText(apiKey, placesRequest(kind, near), fetchImpl));
}

async function searchText(apiKey: string, body: object, fetchImpl: PostFetch): Promise<unknown> {
  const response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Places responded ${response.status}`);
  return response.json();
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
