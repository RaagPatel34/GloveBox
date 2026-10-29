import type { TripServices } from "../agent/trip";
import { findPlace, findPlaces, type PostFetch } from "../maps";
import type { GasPrice } from "../types";

// The spec's demo errand: gas, a car wash and a grocery stop toward Santa Ana, starting from
// the demo car's home (Knott's Berry Farm, Buena Park). Google's answers are canned in the
// shape Places (New) returns, so tests and demos need no key. Illustrative places on the
// way from Buena Park to Santa Ana, not live listings.

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

// Three stations close enough to each other that a detour verdict has something to decide.
export const DEMO_GAS_STATIONS = [
  place("Chevron", "7501 Beach Blvd, Buena Park, CA 90620", 33.8582, -118.0001),
  place("Arco", "13201 Harbor Blvd, Garden Grove, CA 92843", 33.7716, -117.9154),
  place("Shell", "1025 W 17th St, Santa Ana, CA 92706", 33.7448, -117.8812),
];

export const DEMO_CAR_WASHES = [
  place("Mister Car Wash", "6800 Beach Blvd, Buena Park, CA 90621", 33.8651, -117.9993),
  place("Santa Ana Express Wash", "1610 E 17th St, Santa Ana, CA 92705", 33.7452, -117.8499),
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

// Trip services for the demo errand: canned Places through the real Google adapter, the stops
// driven in the order given for a fixed distance, and a fixed weekly price.
export function demoTripServices() {
  const fetchImpl = demoPlacesFetch();
  const services: TripServices = {
    findPlace: (query, near) => findPlace("demo", query, near, fetchImpl),
    findPlaces: (kind, where) => findPlaces("demo", kind, where, fetchImpl),
    route: async (_home, stops) => ({ order: stops, miles: 14.2, minutes: 31 }),
    gasPrice: async () => DEMO_GAS_PRICE,
  };
  return { services, requests: fetchImpl.requests };
}

// A fake Places searchText: canned answers by what the request asks for, with every request
// body recorded so a test can check what was sent.
export function demoPlacesFetch() {
  const requests: { textQuery: string; includedType?: string; locationBias?: unknown }[] = [];
  const fetchImpl: PostFetch = async (_url, init) => {
    const request = JSON.parse(String(init.body)) as (typeof requests)[number];
    requests.push(request);
    const places =
      request.includedType === "gas_station" ? DEMO_GAS_STATIONS
      : request.includedType === "car_wash" ? DEMO_CAR_WASHES
      : /trader joe/i.test(request.textQuery) ? [DEMO_GROCERY]
      : [];
    return Response.json({ places });
  };
  return Object.assign(fetchImpl, { requests });
}
