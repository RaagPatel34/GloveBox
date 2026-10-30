import type { GasPriceQuery, TripServices } from "./agent/trip";
import { EIA_AREAS, fetchRegionalPrice, fetchTavilyPrice, type Fetcher } from "./gas-price";
import { computeLoopRoute, findPlace, findPlaces } from "./maps";
import type { GasPrice } from "./types";

// Google Maps, EIA and (when switched on) Tavily behind the trip agent, shared by the Trips
// panel and the command bar. Server-only: the keys are server keys.

// The live services, or null unless Google Maps is switched on and both keys are set.
export function tripServices(env: Record<string, string | undefined> = process.env, fetchImpl: Fetcher = fetch): TripServices | null {
  const mapsKey = env.ENABLE_MAPS === "true" ? env.GOOGLE_MAPS_API_KEY : undefined;
  const eiaKey = env.EIA_API_KEY;
  const tavilyKey = env.ENABLE_TAVILY === "true" ? env.TAVILY_API_KEY : undefined;
  if (!mapsKey || !eiaKey) return null;
  // The Los Angeles weekly average, or California's when LA's is unavailable.
  const eia = () => fetchRegionalPrice(eiaKey, EIA_AREAS.la, new Date(), fetchImpl)
    .catch(() => fetchRegionalPrice(eiaKey, EIA_AREAS.ca, new Date(), fetchImpl));
  return {
    findPlace: (query, near) => findPlace(mapsKey, query, near),
    findPlaces: (kind, near) => findPlaces(mapsKey, kind, near),
    route: (from, stops) => computeLoopRoute(mapsKey, from, stops),
    // A dated price for the station or area from Tavily, else the EIA average.
    gasPrice: async (at?: GasPriceQuery): Promise<GasPrice> => {
      if (tavilyKey && (at?.station || at?.area)) {
        try { return await fetchTavilyPrice(tavilyKey, at, fetchImpl); } catch { /* no dated price: use EIA */ }
      }
      return eia();
    },
  };
}
