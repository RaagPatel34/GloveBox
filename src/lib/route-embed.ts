import { MAX_TRIP_STOPS } from "./trip";
import type { TripStop, Vehicle } from "./types";

// What Google's Maps Embed API documents for a Directions embed: up to 20 waypoints between
// the origin and the destination.
export const EMBED_API_MAX_WAYPOINTS = 20;

// What GloveBox draws: a full trip plan (MAX_TRIP_STOPS stops) with home at both ends. The
// planner's own cap is lower, and both sit well inside the Embed API's limit above.
export const MAX_EMBED_POINTS = MAX_TRIP_STOPS + 2;

// The longest a point may be, the same bound the route planner puts on an address.
const MAX_POINT_LENGTH = 200;

const coordinates = (place: { lat: number; lng: number }) => `${place.lat},${place.lng}`;

// The points the planned drive passes through, as the Embed API reads them: home, the stops
// in the plan's driving order, then home again. Coordinates, not addresses, so the map draws
// exactly the route that was costed. A plan with no stops has no route to draw, so no points.
export function tripRoutePoints(home: Vehicle["home"], stops: TripStop[]): string[] {
  if (stops.length === 0) return [];
  return [coordinates(home), ...stops.map(coordinates), coordinates(home)];
}

// Whether the points can be drawn: two to MAX_EMBED_POINTS, each non-empty and under
// MAX_POINT_LENGTH characters, and none containing "|", which the embed reads as the
// separator between waypoints (so an address with one would become extra stops). Coordinates
// ("lat,lng") and addresses both pass.
export function canDrawRoute(points: string[]): boolean {
  return (
    points.length >= 2 &&
    points.length <= MAX_EMBED_POINTS &&
    points.every((point) => point.trim() !== "" && point.length < MAX_POINT_LENGTH && !point.includes("|"))
  );
}

// The Directions-mode embed URL for points in driving order (first is the origin, last the
// destination), or null when it cannot be one: no browser key, or points `canDrawRoute`
// refuses. `key` is the domain-restricted browser key, never the server key. The URL is only
// ever used as an iframe `src`, so loading it is what shares the points with Google.
export function routeEmbedUrl(points: string[], key: string | undefined): string | null {
  const browserKey = key?.trim();
  if (!browserKey || !canDrawRoute(points)) return null;
  const trimmed = points.map((point) => point.trim());
  const params = new URLSearchParams({
    key: browserKey,
    origin: trimmed[0],
    destination: trimmed[trimmed.length - 1],
    mode: "driving",
  });
  if (trimmed.length > 2) params.set("waypoints", trimmed.slice(1, -1).join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${params}`;
}
