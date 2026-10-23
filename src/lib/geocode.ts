import { parseGeocodeResult } from "./setup";
import type { LatLng } from "./types";

// Free-text US place ("Buena Park, CA", "92683", a landmark) -> coordinates, via OpenStreetMap's
// Nominatim (no key). Their usage policy asks for an identifying User-Agent and light use,
// which a once-per-signup lookup respects. Google geocoding can replace this later.
export async function geocode(query: string): Promise<(LatLng & { label: string }) | null> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", countrycodes: "us", limit: "1", addressdetails: "1" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "GloveBox/0.1 (hackathon app; car upkeep co-pilot)", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
  return parseGeocodeResult(await res.json());
}
