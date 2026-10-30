import type { TripServices } from "../agent/trip";
import { findPlace, findPlaces, type Place, type PostFetch } from "../maps";
import type { GasPrice } from "../types";

// The spec's demo errand (docs/SPEC.md, "Demo car"): gas, a car wash and a grocery stop toward
// Santa Ana, starting from the demo car's home (Knott's Berry Farm, Buena Park). The gas
// stations and washes are the ones a search near home turns up, within a couple of miles of it;
// the grocery stop is in Santa Ana. Google's answers are canned in
// the shape Places (New) returns, so tests and demos need no key. Illustrative places, not
// live listings.

export const DEMO_ERRAND = "gas, car wash and Trader Joe's in Santa Ana";

// What the command bar's router reads out of DEMO_ERRAND.
export const DEMO_ERRAND_STOPS = [
  { type: "gas" },
  { type: "wash" },
  { type: "address", name: "Trader Joe's, Santa Ana, CA" },
];

const place = (name: string, address: string, latitude: number, longitude: number) => ({
  id: `demo-${latitude}`,
  displayName: { text: name, languageCode: "en" },
  formattedAddress: address,
  location: { latitude, longitude },
});

// Three stations within about two miles of home, close enough that a detour verdict has
// something to decide.
export const DEMO_GAS_STATIONS = [
  place("Chevron", "7501 Beach Blvd, Buena Park, CA 90620", 33.8582, -118.0001),
  place("Arco", "6401 Orangethorpe Ave, Buena Park, CA 90620", 33.8481, -118.0234),
  place("Shell", "1500 S Beach Blvd, Anaheim, CA 92804", 33.8186, -118.0043),
];

// Far from home, near the grocery stop: a search around home must not find it.
export const DEMO_SANTA_ANA_STATION = place("76", "1025 W 17th St, Santa Ana, CA 92706", 33.7448, -117.8812);

export const DEMO_CAR_WASHES = [
  place("Mister Car Wash", "6800 Beach Blvd, Buena Park, CA 90621", 33.8651, -117.9993),
  place("Orangethorpe Express Wash", "5500 Orangethorpe Ave, Buena Park, CA 90621", 33.8478, -118.019),
];

export const DEMO_GROCERY = place("Trader Joe's", "3333 W 1st St, Santa Ana, CA 92703", 33.7466, -117.9139);

export const DEMO_GAS_PRICE: GasPrice = {
  price: 5.883,
  asOf: "2026-10-26",
  source: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_Y05LA_DPG&f=W",
  kind: "eia",
  label: "Los Angeles weekly regular gasoline average",
  stale: false,
};

// Each demo station's price, by address. Illustrative figures for the demo's detour verdict, not
// quotes: their label and source say so, and the source is no link, so nothing reads as a real
// station's page. Chevron is on the way; Arco is cheap enough to be worth the extra miles.
const DEMO_STATION_PRICES: Record<string, number> = {
  "7501 Beach Blvd, Buena Park, CA 90620": 5.199,
  "6401 Orangethorpe Ave, Buena Park, CA 90620": 4.899,
  "1500 S Beach Blvd, Anaheim, CA 92804": 5.099,
};

export const DEMO_PRICE_SOURCE = "GloveBox demo price, not a live quote";

function demoStationPrice(station: Place): GasPrice | null {
  const price = DEMO_STATION_PRICES[station.label];
  if (price === undefined) return null;
  return { price, asOf: "2026-10-26", source: DEMO_PRICE_SOURCE, kind: "station", label: `Demo price for ${station.name}` };
}

// Road miles run about this much longer than the straight lines between stops.
const ROAD_FACTOR = 1.25;
// Average speed for the demo's drive time, mostly surface streets.
const DEMO_MPH = 30;

// Trip services for the demo errand: canned Places through the real Google adapter, the stops
// driven in the order given, the miles from the straight-line loop home -> stops -> home (so a
// farther station adds miles), canned prices for the three stations near home, and a fixed
// weekly price otherwise, as the live services fall back to EIA.
export function demoTripServices() {
  const fetchImpl = demoPlacesFetch();
  const services: TripServices = {
    findPlace: (query, near) => findPlace("demo", query, near, fetchImpl),
    findPlaces: (kind, near) => findPlaces("demo", kind, near, fetchImpl),
    route: async (home, stops) => {
      const points = [home, ...stops, home].map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
      const meters = points.slice(1).reduce((sum, point, i) => sum + metersBetween(points[i], point), 0);
      const miles = Math.round((meters / 1609.344) * ROAD_FACTOR * 10) / 10;
      return { order: stops, miles, minutes: Math.round((miles / DEMO_MPH) * 60) };
    },
    gasPrice: async (at) => (at?.station && demoStationPrice(at.station)) || DEMO_GAS_PRICE,
  };
  return { services, requests: fetchImpl.requests };
}

type Located = ReturnType<typeof place>;
type Circle = { center: { latitude: number; longitude: number }; radius: number };

// Meters between two points, close enough for a few miles.
function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRadians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRadians;
  const dLng = (b.longitude - a.longitude) * toRadians * Math.cos(((a.latitude + b.latitude) / 2) * toRadians);
  return Math.hypot(dLat, dLng) * 6_371_000;
}

// A fake Places searchText: canned answers by what the request asks for and where. A search
// for a kind of stop returns only the ones inside its location-bias circle (the real API only
// prefers them, but a fake that ignored the location would pass for any search, anywhere).
// Every request body is recorded so a test can check what was sent.
export function demoPlacesFetch() {
  const requests: { textQuery: string; includedType?: string; locationBias?: { circle?: Circle } }[] = [];
  const within = (places: Located[], circle?: Circle) =>
    circle ? places.filter((p) => metersBetween(circle.center, p.location) <= circle.radius) : [];
  const fetchImpl: PostFetch = async (_url, init) => {
    const request = JSON.parse(String(init.body)) as (typeof requests)[number];
    requests.push(request);
    const circle = request.locationBias?.circle;
    const places =
      request.includedType === "gas_station" ? within([...DEMO_GAS_STATIONS, DEMO_SANTA_ANA_STATION], circle)
      : request.includedType === "car_wash" ? within(DEMO_CAR_WASHES, circle)
      : /trader joe/i.test(request.textQuery) ? [DEMO_GROCERY]
      : [];
    return Response.json({ places });
  };
  return Object.assign(fetchImpl, { requests });
}
