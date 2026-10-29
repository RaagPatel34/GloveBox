import type { TripServices } from "./agent/trip";
import { EIA_AREAS, fetchRegionalPrice } from "./gas-price";
import { computeLoopRoute, findPlace, findPlaces } from "./maps";

// Google Maps and EIA behind the trip agent, shared by the Trips panel and the command bar.
// Server-only: the keys are server keys.

// The live services, or null unless Google Maps is switched on and both keys are set.
export function tripServices(env: Record<string, string | undefined> = process.env): TripServices | null {
  const mapsKey = env.ENABLE_MAPS === "true" ? env.GOOGLE_MAPS_API_KEY : undefined;
  const eiaKey = env.EIA_API_KEY;
  if (!mapsKey || !eiaKey) return null;
  return {
    findPlace: (query, near) => findPlace(mapsKey, query, near),
    findPlaces: (kind, where) => findPlaces(mapsKey, kind, where),
    route: (from, stops) => computeLoopRoute(mapsKey, from, stops),
    // The Los Angeles weekly average, or California's when LA's is unavailable.
    gasPrice: () => fetchRegionalPrice(eiaKey, EIA_AREAS.la).catch(() => fetchRegionalPrice(eiaKey, EIA_AREAS.ca)),
  };
}
