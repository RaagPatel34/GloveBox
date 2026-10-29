import type { TripStop, Vehicle } from "./types";

// The Maps Embed API takes a limited number of waypoints. A trip has at most eight stops, so
// this stays under what the embed documents and above what a plan can need.
export const MAX_EMBED_WAYPOINTS = 9;

const coordinates = (place: { lat: number; lng: number }) => `${place.lat},${place.lng}`;

// The points the planned drive passes through, as the Embed API reads them: home, the stops
// in the plan's driving order, then home again. Coordinates, not addresses, so the map draws
// exactly the route that was costed.
export function tripRoutePoints(home: Vehicle["home"], stops: TripStop[]): string[] {
  return [coordinates(home), ...stops.map(coordinates), coordinates(home)];
}

// The Directions-mode embed URL for points in driving order (first is the origin, last the
// destination), or null when it cannot be one: no browser key, fewer than two points or too
// many waypoints. `key` is the domain-restricted browser key, never the server key. The URL
// is only ever used as an iframe `src`, so loading it is what shares the points with Google.
export function routeEmbedUrl(points: string[], key: string | undefined): string | null {
  const browserKey = key?.trim();
  if (!browserKey || points.length < 2 || points.length - 2 > MAX_EMBED_WAYPOINTS) return null;
  const params = new URLSearchParams({
    key: browserKey,
    origin: points[0],
    destination: points[points.length - 1],
    mode: "driving",
  });
  if (points.length > 2) params.set("waypoints", points.slice(1, -1).join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${params}`;
}
