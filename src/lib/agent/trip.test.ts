import { describe, expect, it } from "vitest";
import { DEMO_CAR_WASHES, DEMO_ERRAND_STOPS, DEMO_GAS_STATIONS, demoPlacesFetch } from "../fixtures/demo-trip";
import { demoCar } from "../fixtures/demo-car";
import { findPlace, findPlaces, type Place, type StopKind } from "../maps";
import { NOW } from "../test-support";
import type { GasPrice, LatLng } from "../types";
import { planTrip, type TripServices } from "./trip";
import { callTools, say, scriptedChat } from "./scripted-chat";

const HOME = { label: "Buena Park City Hall, 6650 Beach Blvd, Buena Park, CA", lat: 33.8675, lng: -117.9981 };

const PLACES: Record<string, Place> = {
  "trader joe's": { name: "Trader Joe's", label: "12861 Towne Center Dr, Cerritos, CA 90703", lat: 33.869, lng: -118.058 },
  "santa ana city hall": { name: "Santa Ana City Hall", label: "20 Civic Center Plaza, Santa Ana, CA 92701", lat: 33.7493, lng: -117.8733 },
  "knott's berry farm": { name: "Knott's Berry Farm", label: "8039 Beach Blvd, Buena Park, CA 90620", lat: 33.8443, lng: -117.9989 },
};

const LA_PRICE = {
  price: 5.883,
  asOf: "2026-10-26",
  source: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_Y05LA_DPG&f=W",
  kind: "eia" as const,
  label: "Los Angeles weekly regular gasoline average",
  stale: false,
};

// Fake Google and EIA: places by lower-cased name, a route that drives the stops in
// reverse of the order given, and a fixed weekly price. Every call is recorded.
function fakeServices(overrides: Partial<TripServices> = {}) {
  const calls: { findPlace: string[]; findPlaces: [StopKind, LatLng][]; route: LatLng[][] } = { findPlace: [], findPlaces: [], route: [] };
  const services: TripServices = {
    findPlace: async (query) => {
      calls.findPlace.push(query);
      return PLACES[query.toLowerCase()] ?? null;
    },
    findPlaces: async (kind, near) => {
      calls.findPlaces.push([kind, near]);
      return [];
    },
    route: async (_home, stops) => {
      calls.route.push(stops);
      return { order: [...stops].reverse(), miles: 32, minutes: 51 };
    },
    gasPrice: async () => LA_PRICE,
    ...overrides,
  };
  return { services, calls };
}

describe("planTrip", () => {
  it("keeps distinct gas and wash businesses at the same street address", async () => {
    const station = { name: "Gas station", label: "100 Main St", lat: 33.85, lng: -118 };
    const wash = { name: "Car wash", label: station.label, lat: 33.8501, lng: -118 };
    const { services } = fakeServices({ findPlaces: async (kind) => [kind === "gas" ? station : wash] });
    const chat = scriptedChat({ super: [
      callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["getGasPrice", {}]),
      callTools(["computeRoute", {}]),
    ] });

    const reply = await planTrip({ stops: [{ type: "gas" }, { type: "wash" }], home: HOME, mpg: 32, chat, services });

    expect(reply.plan?.stops).toEqual([{ type: "wash", ...wash }, { type: "gas", ...station }]);
    expect(new URL(reply.plan!.mapsUrl).searchParams.get("waypoints")).toBe(`${wash.lat},${wash.lng}|${station.lat},${station.lng}`);
  });

  it("orders the stops from home by the route, and prices the drive in code from the route miles, MPG and EIA price", async () => {
    const chat = scriptedChat({
      super: [
        callTools(["geocode", { query: "Trader Joe's" }], ["geocode", { query: "Santa Ana City Hall" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
      ],
    });
    const { services } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's", "Santa Ana City Hall"], home: HOME, mpg: 32, chat, services });

    expect(reply.model).toBe("super");
    expect(reply.message).toBe("Round trip from home: 2 stops, 32.0 mi, $5.88 in fuel.");
    expect(reply.plan).toEqual({
      stops: [
        { type: "address", name: "Santa Ana City Hall", label: "20 Civic Center Plaza, Santa Ana, CA 92701", lat: 33.7493, lng: -117.8733 },
        { type: "address", name: "Trader Joe's", label: "12861 Towne Center Dr, Cerritos, CA 90703", lat: 33.869, lng: -118.058 },
      ],
      totalMiles: 32,
      totalMinutes: 51,
      // 32 mi ÷ 32 MPG × $5.883
      fuelCost: 5.883,
      gasPrice: LA_PRICE,
      model: "super",
      mapsUrl: expect.stringContaining("https://www.google.com/maps/dir/?api=1"),
    });
    // Done once the route and price are in: no closing reply to wait on.
    expect(chat.requests).toHaveLength(2);
    expect(chat.requests.every((r) => r.tier === "super")).toBe(true);
  });

  it.each([
    ["a gas price under a cent", { gasPrice: async () => ({ ...LA_PRICE, price: 0.005 }) }],
    ["a route over the mileage limit", { route: async (_home: LatLng, stops: Place[]) => ({ order: stops, miles: 20000, minutes: 51 }) }],
  ])("answers with a message, not an error, when %s can't be costed", async (_name, overrides) => {
    const chat = scriptedChat({ super: [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])] });
    const { services } = fakeServices(overrides);

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(reply.plan).toBeNull();
    expect(reply.message).toMatch(/cost|price|distance/i);
    expect(reply.model).toBe("super");
  });

  it("names a stop Google can't find instead of routing the rest", async () => {
    const chat = scriptedChat({
      super: [callTools(["geocode", { query: "Trader Joe's" }], ["geocode", { query: "Blorfville Mall" }], ["getGasPrice", {}])],
    });
    const { services, calls } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's", "Blorfville Mall"], home: HOME, mpg: 32, chat, services });

    expect(reply).toEqual({
      model: "super",
      message: "I couldn't find “Blorfville Mall” on the map. Check the spelling or add a city, then plan again.",
      plan: null,
    });
    expect(calls.route).toHaveLength(0);
    expect(chat.requests).toHaveLength(1);
  });

  it("looks up only the user's stops, and routes only once every stop is found", async () => {
    const chat = scriptedChat({
      super: [
        callTools(["computeRoute", {}], ["geocode", { query: "Disneyland" }]),
        callTools(["geocode", { query: "  trader JOE'S " }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
      ],
    });
    const { services, calls } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    const firstResults = chat.requests[1].messages.slice(-2).map((m) => JSON.parse(m.content as string));
    expect(firstResults).toEqual([
      { error: 'Geocode these stops first: ["Trader Joe\'s"].' },
      { error: 'Geocode only the user\'s stops, as written: ["Trader Joe\'s"].' },
    ]);
    expect(calls.findPlace).toEqual(["Trader Joe's"]);
    expect(calls.route).toEqual([[PLACES["trader joe's"]]]);
    expect(reply.plan?.stops.map((s) => s.name)).toEqual(["Trader Joe's"]);
  });

  // A car set up in the browser saves home as typed, at 0,0.
  it("finds a home saved without coordinates before routing from it", async () => {
    const chat = scriptedChat({
      super: [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });
    const homes: LatLng[] = [];
    const { services } = fakeServices({
      route: async (home, stops) => {
        homes.push(home);
        return { order: stops, miles: 10, minutes: 20 };
      },
    });

    const reply = await planTrip({ stops: ["Trader Joe's"], home: { label: "Knott's Berry Farm", lat: 0, lng: 0 }, mpg: 32, chat, services });

    expect(homes).toEqual([PLACES["knott's berry farm"]]);
    expect(reply.plan?.mapsUrl).toContain("origin=33.8443%2C-117.9989");
  });

  it("asks for a home it can find before calling the model", async () => {
    const chat = scriptedChat({});
    const { services } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's"], home: { label: "Atlantis", lat: 0, lng: 0 }, mpg: 32, chat, services });

    expect(reply).toEqual({
      model: null,
      message: "I couldn't find your home (“Atlantis”) on the map. Update your location in Car & settings, then plan again.",
      plan: null,
    });
  });

  // What the browser garage saves when the owner left the location blank.
  it("never searches the map for the no-location placeholder", async () => {
    const { services, calls } = fakeServices({ findPlace: async () => PLACES["trader joe's"] });

    const reply = await planTrip({ stops: ["Trader Joe's"], home: { label: "Location not set", lat: 0, lng: 0 }, mpg: 32, chat: scriptedChat({}), services });

    expect(reply).toEqual({ model: null, message: "Add your home location in Car & settings, then plan again.", plan: null });
    expect(calls.findPlace).toEqual([]);
  });

  it("drives to a place once when two stops turn out to be the same place", async () => {
    const chat = scriptedChat({
      super: [
        callTools(["geocode", { query: "Trader Joe's" }], ["geocode", { query: "12861 Towne Center Dr" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}], ["computeRoute", {}]),
      ],
    });
    const { services, calls } = fakeServices({
      findPlace: async (query) => (calls.findPlace.push(query), PLACES["trader joe's"]),
    });

    const reply = await planTrip({ stops: ["Trader Joe's", "12861 Towne Center Dr"], home: HOME, mpg: 32, chat, services });

    expect(calls.route).toEqual([[PLACES["trader joe's"]]]);
    expect(reply.plan?.stops).toHaveLength(1);
  });

  it.each([0, 0.001])("keeps distinct businesses at the same street address (coordinate offset %s)", async (offset) => {
    const stops = ["Mall pharmacy", "Mall grocery"];
    const places = stops.map((name, index) => ({ name, label: "100 Main St, Buena Park, CA", lat: 33.87 + index * offset, lng: -118 }));
    const chat = scriptedChat({ super: [
      callTools(["geocode", { query: stops[0] }], ["geocode", { query: stops[1] }], ["getGasPrice", {}]),
      callTools(["computeRoute", {}]),
    ] });
    const { services, calls } = fakeServices({ findPlace: async (query) => places[stops.indexOf(query)] });

    const reply = await planTrip({ stops, home: HOME, mpg: 32, chat, services });

    expect(calls.route).toEqual([places]);
    expect(reply.plan?.stops.map((place) => place.name)).toEqual([...stops].reverse());
    const url = new URL(reply.plan!.mapsUrl);
    expect(url.searchParams.get("waypoints")).toBe([...places].reverse().map((place) => `${place.lat},${place.lng}`).join("|"));
  });

  it("finishes eight stops when the model calls each tool in a separate turn", async () => {
    const stops = Array.from({ length: 8 }, (_, i) => `Stop ${i + 1}`);
    const chat = scriptedChat({ super: [
      ...stops.map((query) => callTools(["geocode", { query }])),
      callTools(["getGasPrice", {}]),
      callTools(["computeRoute", {}]),
    ] });
    const { services } = fakeServices({
      findPlace: async (query) => ({ name: query, label: `${query}, Buena Park, CA`, lat: 33.87, lng: -118 }),
    });

    const reply = await planTrip({ stops, home: HOME, mpg: 32, chat, services });

    expect(reply.plan?.stops.map((place) => place.name)).toEqual([...stops].reverse());
    expect(chat.requests).toHaveLength(10);
  });
  it("asks for one to eight distinct stops before calling the model", async () => {
    const { services, calls } = fakeServices();
    const ask = "Enter 1–8 different stops, each under 200 characters.";
    for (const stops of [undefined, [], [" "], Array(9).fill(0).map((_, i) => `Stop ${i}`), ["a".repeat(201)], ["Trader Joe's", "trader joe's"], [42]]) {
      const reply = await planTrip({ stops, home: HOME, mpg: 32, chat: scriptedChat({}), services });
      expect(reply).toEqual({ model: null, message: ask, plan: null });
    }
    expect(calls.findPlace).toHaveLength(0);
  });

  it("asks for a fuel economy it can price before calling the model", async () => {
    const { services } = fakeServices();
    for (const mpg of [0, NaN, 151]) {
      const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg, chat: scriptedChat({}), services });
      expect(reply).toEqual({ model: null, message: "Set your car's fuel economy (1–150 MPG) in Car & settings, then plan again.", plan: null });
    }
  });

  it("says the trip agent is offline when the AI isn't connected", async () => {
    const { services } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat: null, services });

    expect(reply).toEqual({
      model: null,
      message: "The trip agent isn't connected right now. You can still plan the drive by hand below.",
      plan: null,
    });
  });

  it("asks for the price around home's city, or the regional average when home names none", async () => {
    const asked: unknown[] = [];
    const { services } = fakeServices({ gasPrice: async (at) => (asked.push(at), LA_PRICE) });
    const steps = () => [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])];

    await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat: scriptedChat({ super: steps() }), services });
    await planTrip({ stops: ["Trader Joe's"], home: { ...HOME, label: "8039 Beach Blvd, Buena Park, CA 90620, USA" }, mpg: 32, chat: scriptedChat({ super: steps() }), services });
    await planTrip({ stops: ["Trader Joe's"], home: { ...HOME, label: "My place" }, mpg: 32, chat: scriptedChat({ super: steps() }), services });

    expect(asked).toEqual([{ area: "Buena Park, CA" }, { area: "Buena Park, CA" }, undefined]);
  });

  it("gives no plan without a gas price, saying where the price comes from", async () => {
    const chat = scriptedChat({ super: [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}])] });
    const { services } = fakeServices({
      gasPrice: async () => {
        throw new Error("EIA responded 503");
      },
    });

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(reply).toEqual({
      model: "super",
      message: "I couldn't get this week's gas price from the EIA, so I can't price the drive. Please try again shortly.",
      plan: null,
    });
  });

  it("says when Google can't route the stops", async () => {
    const chat = scriptedChat({
      super: [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });
    const { services } = fakeServices({
      route: async () => {
        throw new Error("No usable driving route returned.");
      },
    });

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(reply.message).toBe("Google couldn't plan a driving route through these stops just now. Please try again.");
    expect(reply.plan).toBeNull();
  });

  it("says when the AI can't be reached", async () => {
    const chat = async () => {
      throw new Error("timeout");
    };
    const { services } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(reply).toEqual({ model: null, message: "Could not reach the AI just now. Please try again in a moment. You can still plan the drive by hand below.", plan: null });
  });

  it("says so when the model stops before the plan is done", async () => {
    const chat = scriptedChat({ super: [callTools(["geocode", { query: "Trader Joe's" }]), say("All done!")] });
    const { services } = fakeServices();

    const reply = await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(reply).toEqual({ model: "super", message: "The trip agent didn't finish the plan. Please try again.", plan: null });
  });

  it("looks a named place up near home, so Trader Joe's means the one close by", async () => {
    const chat = scriptedChat({
      super: [callTools(["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });
    const nears: (LatLng | undefined)[] = [];
    const { services } = fakeServices({
      findPlace: async (query, near) => (nears.push(near), PLACES[query.toLowerCase()]),
    });

    await planTrip({ stops: ["Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(nears).toEqual([HOME]);
  });
});

describe("planTrip: gas and car-wash stops", () => {
  // The spec's demo: from the demo car's home, gas + a car wash + a grocery stop toward Santa Ana,
  // answered by canned Places responses through the real Google adapter.
  const { vehicle } = demoCar(NOW, "11111111-2222-4333-8444-555555555555", () => "id");

  function demoServices() {
    const fetchImpl = demoPlacesFetch();
    const fake = fakeServices({
      findPlace: (query, near) => findPlace("key", query, near, fetchImpl),
      findPlaces: (kind, near) => findPlaces("key", kind, near, fetchImpl),
    });
    return { ...fake, fetchImpl };
  }

  // Three gas stations near home, so Ultra plans it. With only the EIA average to go on, it
  // has no station prices to weigh and says so.
  const demoChat = (tier: "super" | "ultra" = "ultra") =>
    scriptedChat({
      [tier]: [
        callTools(
          ["findNearby", { type: "gas" }],
          ["findNearby", { type: "wash" }],
          ["geocode", { query: "Trader Joe's, Santa Ana, CA" }],
          ["getGasPrice", {}],
        ),
        callTools(["computeRoute", {}]),
        say("No station prices to compare."),
      ],
    });

  it("turns gas and a car wash into real, named places on the route, near home", async () => {
    const chat = demoChat();
    const { services, fetchImpl } = demoServices();

    const reply = await planTrip({ stops: DEMO_ERRAND_STOPS, home: vehicle.home, mpg: vehicle.epaMpg, chat, services, ultra: true });

    expect(reply.plan?.stops.map(({ type, name, label }) => ({ type, name, label }))).toEqual([
      { type: "address", name: "Trader Joe's", label: "3333 W 1st St, Santa Ana, CA 92703" },
      { type: "wash", name: "Mister Car Wash", label: "6800 Beach Blvd, Buena Park, CA 90621" },
      { type: "gas", name: "Chevron", label: "7501 Beach Blvd, Buena Park, CA 90620" },
    ]);
    expect(reply.message).toBe("Round trip from home: 3 stops, 32.0 mi, $5.54 in fuel.");
    // Both searches are centered on home: the demo car's, 8 km (about 5 miles) around.
    const centers = fetchImpl.requests.filter((r) => r.includedType).map((r) => r.locationBias);
    const home = { latitude: vehicle.home.lat, longitude: vehicle.home.lng };
    expect(centers).toEqual([{ circle: { center: home, radius: 8000 } }, { circle: { center: home, radius: 8000 } }]);
  });

  it("finds at least two candidate gas stations toward Santa Ana, for the detour verdict to decide between", async () => {
    const chat = demoChat();
    const { services } = demoServices();

    const reply = await planTrip({ stops: DEMO_ERRAND_STOPS, home: vehicle.home, mpg: vehicle.epaMpg, chat, services, ultra: true });

    const candidates = reply.plan?.gasCandidates ?? [];
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates.map((c) => c.name)).toEqual(DEMO_GAS_STATIONS.map((s) => s.displayName.text));
    expect(candidates.every((c) => c.type === "gas" && c.label && Number.isFinite(c.lat))).toBe(true);
    // The plan uses the first candidate; the model sees all of them, but only code picks.
    const [gasResult] = chat.requests[1].messages.slice(-4).map((m) => JSON.parse(m.content as string));
    expect(gasResult.candidates.map((c: { name: string }) => c.name)).toEqual(["Chevron", "Arco", "Shell"]);
    expect(reply.plan?.stops.find((s) => s.type === "gas")?.name).toBe("Chevron");
  });

  it("finds no gas station or car wash far from the demo stations, rather than the same ones anywhere", async () => {
    // No gas station to choose between, so Super.
    const chat = demoChat("super");
    const { services } = demoServices();
    const sanFrancisco = { label: "Union Square, San Francisco, CA", lat: 37.788, lng: -122.4075 };

    const reply = await planTrip({ stops: DEMO_ERRAND_STOPS, home: sanFrancisco, mpg: vehicle.epaMpg, chat, services });

    expect(reply).toEqual({
      model: "super",
      message: "I couldn't find a gas station or a car wash near you on the map. Name a specific one, then plan again.",
      plan: null,
    });
  });

  it("has no gas candidates when the trip needs no gas", async () => {
    const chat = scriptedChat({
      super: [callTools(["findNearby", { type: "wash" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });
    const { services } = demoServices();

    const reply = await planTrip({ stops: [{ type: "wash" }], home: vehicle.home, mpg: vehicle.epaMpg, chat, services });

    expect(reply.plan?.stops.map((s) => s.name)).toEqual([DEMO_CAR_WASHES[0].displayName.text]);
    expect(reply.plan?.gasCandidates).toBeUndefined();
  });

  it("can search near one of the user's own stops once it has been found, not before", async () => {
    const chat = scriptedChat({
      super: [
        callTools(["findNearby", { type: "gas", near: "Trader Joe's" }], ["geocode", { query: "Trader Joe's" }]),
        callTools(["findNearby", { type: "gas", near: "Trader Joe's" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
      ],
    });
    const { services, calls } = fakeServices({
      findPlaces: async (kind, near) => (calls.findPlaces.push([kind, near]), [DEMO_STATION]),
    });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 32, chat, services, ultra: true });

    const [early] = chat.requests[1].messages.slice(-2).map((m) => JSON.parse(m.content as string));
    expect(early).toEqual({ error: 'Geocode "Trader Joe\'s" before searching near it.' });
    // Near home before the model starts (to pick its tier), then near Trader Joe's once found.
    expect(calls.findPlaces).toEqual([["gas", { lat: HOME.lat, lng: HOME.lng }], ["gas", { lat: 33.869, lng: -118.058 }]]);
    expect(reply.plan?.stops.map((s) => s.type).sort()).toEqual(["address", "gas"]);
  });

  it("searches only for what the user asked for, and only near home or their own stops", async () => {
    const chat = scriptedChat({
      // The script ends after one turn: the model's next request fails, which is all this needs.
      super: [callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash", near: "Disneyland" }], ["findNearby", { type: "bank" }])],
    });
    const { services, calls } = fakeServices();

    await planTrip({ stops: [{ type: "wash" }, "Trader Joe's"], home: HOME, mpg: 32, chat, services });

    const results = chat.requests[1].messages.slice(-3).map((m) => JSON.parse(m.content as string));
    expect(results).toEqual([
      { error: "The user didn't ask for a gas station." },
      { error: 'Search near home (leave near out) or near one of the user\'s own address stops: ["Trader Joe\'s"].' },
      { error: 'Find only "gas" or "wash" stops.' },
    ]);
    expect(calls.findPlaces).toEqual([]);
  });

  it("names the kind of place it can't find instead of routing the rest", async () => {
    const chat = scriptedChat({ super: [callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["getGasPrice", {}])] });
    const { services, calls } = fakeServices({
      findPlaces: async (kind) => (kind === "gas" ? [DEMO_STATION] : []),
    });

    const reply = await planTrip({ stops: [{ type: "gas" }, { type: "wash" }], home: HOME, mpg: 32, chat, services });

    expect(reply).toEqual({
      model: "super",
      message: "I couldn't find a car wash near you on the map. Name a specific one, then plan again.",
      plan: null,
    });
    expect(calls.route).toHaveLength(0);
  });

  it("says so, before calling the model, when the map is down while looking for a gas station", async () => {
    const chat = scriptedChat({});
    const { services } = fakeServices({
      findPlaces: async () => {
        throw new Error("Places responded 503");
      },
    });

    const reply = await planTrip({ stops: [{ type: "gas" }], home: HOME, mpg: 32, chat, services, ultra: true });

    expect(reply).toEqual({ model: null, message: "Couldn't look up places on the map just now. Please try again.", plan: null });
    expect(chat.requests).toHaveLength(0);
  });

  it("searches again when asked to look near somewhere else, and keeps the new candidates", async () => {
    const chat = scriptedChat({
      super: [
        callTools(["findNearby", { type: "gas" }], ["geocode", { query: "Trader Joe's" }]),
        callTools(["findNearby", { type: "gas", near: "Trader Joe's" }], ["getGasPrice", {}]),
        // The same anchor again is not a new search.
        callTools(["findNearby", { type: "gas", near: "Trader Joe's" }], ["computeRoute", {}]),
      ],
    });
    const { services, calls } = fakeServices({
      findPlaces: async (kind, near) => (calls.findPlaces.push([kind, near]), near.lat === HOME.lat ? [DEMO_STATION] : [CERRITOS_STATION]),
    });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 32, chat, services });

    expect(calls.findPlaces).toEqual([["gas", { lat: HOME.lat, lng: HOME.lng }], ["gas", { lat: 33.869, lng: -118.058 }]]);
    const [first] = chat.requests[1].messages.slice(-2).map((m) => JSON.parse(m.content as string));
    const [second] = chat.requests[2].messages.slice(-2).map((m) => JSON.parse(m.content as string));
    expect(first.name).toBe("Chevron");
    expect(second.name).toBe("Arco");
    expect(reply.plan?.stops.find((s) => s.type === "gas")?.name).toBe("Arco");
    expect(reply.plan?.gasCandidates?.map((c) => c.name)).toEqual(["Arco"]);
  });

  it("plans one gas stop, and one car wash, however many times they are typed", async () => {
    const chat = scriptedChat({
      super: [callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });
    const { services } = fakeServices({
      findPlaces: async (kind) => [kind === "gas" ? DEMO_STATION : CERRITOS_STATION],
    });

    const reply = await planTrip({ stops: [{ type: "gas" }, { type: "wash" }, { type: "gas" }, { type: "wash" }], home: HOME, mpg: 32, chat, services });

    expect(reply.plan?.stops.map((s) => s.type).sort()).toEqual(["gas", "wash"]);
    expect(JSON.parse(chat.requests[0].messages.at(-1)!.content as string)).toEqual({ stops: [{ type: "gas" }, { type: "wash" }] });
  });

  it("asks for different stops: named places, each of a sensible length", async () => {
    const { services } = fakeServices();
    const ask = "Enter 1–8 different stops, each under 200 characters.";
    const places = [{ type: "address", name: "Trader Joe's" }, { type: "address", name: " trader joe's " }];
    for (const stops of [[{ type: "teleport" }], [{ type: "address", name: " " }], [{ type: "address" }], places, [{ type: "gas" }, "x".repeat(201)]]) {
      const reply = await planTrip({ stops, home: HOME, mpg: 32, chat: scriptedChat({}), services });
      expect(reply).toEqual({ model: null, message: ask, plan: null });
    }
  });
});

const CERRITOS_STATION: Place = { name: "Arco", label: "13800 Carmenita Rd, Cerritos, CA 90703", lat: 33.8701, lng: -118.0602 };
const DEMO_STATION: Place ={ name: "Chevron", label: "7501 Beach Blvd, Buena Park, CA 90620", lat: 33.8582, lng: -118.0001 };

describe("planTrip: Ultra weighs a cheaper gas station", () => {
  // Three stations near home; the route uses the first unless a detour is worth it.
  const CHEVRON: Place = DEMO_STATION;
  const ARCO: Place = { name: "Arco", label: "6311 Lincoln Ave, Buena Park, CA 90620", lat: 33.8318, lng: -118.0081 };
  const SHELL: Place = { name: "Shell", label: "8001 Orangethorpe Ave, Buena Park, CA 90621", lat: 33.8592, lng: -118.0094 };
  const stationPrice = (price: number, station: Place): GasPrice => ({
    price,
    asOf: "2026-10-29T15:00:00.000Z",
    source: `https://www.gasbuddy.com/station/${station.name.toLowerCase()}`,
    kind: "station",
    label: `${station.name}, ${station.label}`,
  });
  const PRICES = new Map<Place, GasPrice | Error>([
    [CHEVRON, stationPrice(5.79, CHEVRON)],
    [ARCO, stationPrice(5.39, ARCO)],
    [SHELL, stationPrice(5.89, SHELL)],
  ]);

  // Twenty miles through the usual station (Chevron); `viaMiles` through any other.
  function ultraServices(options: { viaMiles?: number; prices?: Map<Place, GasPrice | Error> } = {}) {
    const { viaMiles = 23, prices = PRICES } = options;
    const priced: (string | undefined)[] = [];
    const fake = fakeServices({
      findPlaces: async (kind, near) => (fake.calls.findPlaces.push([kind, near]), kind === "gas" ? [CHEVRON, ARCO, SHELL] : []),
      route: async (_home, stops) => {
        fake.calls.route.push(stops);
        const usual = stops.includes(CHEVRON);
        return { order: stops, miles: usual ? 20 : viaMiles, minutes: usual ? 40 : 46 };
      },
      gasPrice: async (at) => {
        priced.push(at?.station?.name);
        if (!at?.station) return LA_PRICE;
        const price = prices.get(at.station);
        if (!price || price instanceof Error) throw price ?? new Error("No price");
        return price;
      },
    });
    return { ...fake, priced };
  }

  const lookups = () => callTools(["findNearby", { type: "gas" }], ["geocode", { query: "Trader Joe's" }], ["getGasPrice", {}]);

  it("runs on Ultra, and only Ultra, when there is more than one gas station to choose from", async () => {
    const chat = scriptedChat({ ultra: [lookups(), callTools(["computeRoute", {}]), say("Chevron is on the way.")] });
    const { services, calls } = ultraServices();

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: true });

    expect(reply.model).toBe("ultra");
    expect(reply.plan?.model).toBe("ultra");
    expect(reply.plan?.detour).toBeUndefined();
    expect(chat.requests.every((r) => r.tier === "ultra")).toBe(true);
    // The search that chose the tier is the one findNearby answers with.
    expect(calls.findPlaces).toEqual([["gas", { lat: HOME.lat, lng: HOME.lng }]]);
  });

  const priceAll = () =>
    callTools(
      ["computeRoute", {}],
      ["getStationPrice", { station: CHEVRON.label }],
      ["getStationPrice", { station: ARCO.label }],
      ["getStationPrice", { station: SHELL.label }],
    );

  it("reroutes through a cheaper station when the detour pays, and prices the fuel there", async () => {
    const chat = scriptedChat({ ultra: [lookups(), priceAll(), callTools(["checkDetour", { station: ARCO.label }])] });
    const { services, calls } = ultraServices();

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: true });

    expect(calls.route).toEqual([[CHEVRON, PLACES["trader joe's"]], [ARCO, PLACES["trader joe's"]]]);
    expect(reply.plan).toMatchObject({
      stops: [{ type: "gas", ...ARCO }, { type: "address", ...PLACES["trader joe's"] }],
      totalMiles: 23,
      totalMinutes: 46,
      gasPrice: PRICES.get(ARCO),
      model: "ultra",
    });
    // 23 mi ÷ 25 MPG × $5.39
    expect(reply.plan?.fuelCost).toBeCloseTo(4.9588, 6);
    expect(new URL(reply.plan!.mapsUrl).searchParams.get("waypoints")).toBe(`${ARCO.lat},${ARCO.lng}|${PLACES["trader joe's"].lat},${PLACES["trader joe's"].lng}`);
    // $0.40 × 10 gal = $4.00 saved; 3 extra mi ÷ 25 MPG × $5.79 = $0.69 to get there.
    expect(reply.plan?.detour).toEqual({
      station: "Arco",
      savings: expect.closeTo(4, 6),
      detourCost: expect.closeTo(0.6948, 6),
      net: expect.closeTo(3.3052, 6),
      worthIt: true,
      price: PRICES.get(ARCO),
      usual: { station: "Chevron", price: PRICES.get(CHEVRON) },
      extraMiles: 3,
      gallons: 10,
    });
    expect(reply.message).toBe("Round trip from home: 2 stops, 23.0 mi, $4.96 in fuel.");
  });

  it("keeps the usual station when the detour costs more than it saves, and still shows the verdict", async () => {
    const chat = scriptedChat({ ultra: [lookups(), priceAll(), callTools(["checkDetour", { station: "Arco" }])] });
    const { services } = ultraServices({ viaMiles: 40 });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: true });

    expect(reply.plan).toMatchObject({
      stops: [{ type: "gas", ...CHEVRON }, { type: "address", ...PLACES["trader joe's"] }],
      totalMiles: 20,
      gasPrice: LA_PRICE,
    });
    // 20 mi ÷ 25 MPG × $5.883, as without a detour.
    expect(reply.plan?.fuelCost).toBeCloseTo(4.7064, 6);
    // $4.00 saved; 20 extra mi ÷ 25 MPG × $5.79 = $4.63 to get there.
    expect(reply.plan?.detour).toMatchObject({ station: "Arco", worthIt: false, extraMiles: 20, net: expect.closeTo(-0.632, 6) });
  });

  it("gives no verdict when a candidate has only an area price to go on", async () => {
    const areaPrice: GasPrice = { ...stationPrice(5.39, ARCO), kind: "area", label: "Buena Park, CA average" };
    const chat = scriptedChat({
      ultra: [lookups(), priceAll(), callTools(["checkDetour", { station: ARCO.label }]), say("No station prices to compare.")],
    });
    const { services, calls } = ultraServices({ prices: new Map([...PRICES, [ARCO, areaPrice]]) });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: true });

    const [checked] = chat.requests[3].messages.slice(-1).map((m) => JSON.parse(m.content as string));
    expect(checked).toEqual({ verdict: null, reason: expect.any(String) });
    expect(calls.route).toHaveLength(1);
    expect(reply.plan?.detour).toBeUndefined();
    expect(reply.plan?.stops[0].name).toBe("Chevron");
    expect(reply.model).toBe("ultra");
  });

  it("plans the trip when one station can't be priced", async () => {
    const chat = scriptedChat({ ultra: [lookups(), priceAll(), callTools(["checkDetour", { station: ARCO.label }])] });
    const { services, priced } = ultraServices({ prices: new Map([...PRICES, [SHELL, new Error("Tavily responded 500")]]) });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: true });

    const shell = JSON.parse(chat.requests[2].messages.at(-1)!.content as string);
    expect(shell).toEqual({ error: "Couldn't price Shell just now." });
    expect(reply.plan?.detour?.worthIt).toBe(true);
    // The weekly price, then each station once: checkDetour reuses the prices already found.
    expect(priced).toEqual([undefined, "Chevron", "Arco", "Shell"]);
  });

  it("plans on Super, with no detour, when Ultra isn't set up, however many stations there are", async () => {
    const chat = scriptedChat({ super: [lookups(), callTools(["computeRoute", {}])] });
    const { services } = ultraServices();

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services, ultra: false });

    expect(reply.model).toBe("super");
    expect(reply.plan).toMatchObject({ model: "super", totalMiles: 20 });
    expect(reply.plan?.detour).toBeUndefined();
    expect(chat.requests.every((r) => r.tier === "super")).toBe(true);
  });

  it("stays on Super, without the station tools, when there is only one gas station", async () => {
    const chat = scriptedChat({ super: [lookups(), callTools(["computeRoute", {}])] });
    const { services } = fakeServices({ findPlaces: async () => [CHEVRON] });

    const reply = await planTrip({ stops: [{ type: "gas" }, "Trader Joe's"], home: HOME, mpg: 25, chat, services });

    expect(reply.model).toBe("super");
    expect(reply.plan).toMatchObject({ model: "super", stops: expect.any(Array) });
    expect(reply.plan?.detour).toBeUndefined();
    expect(chat.requests[0].tools?.flatMap((tool) => (tool.type === "function" ? [tool.function.name] : []))).toEqual(["geocode", "findNearby", "getGasPrice", "computeRoute"]);
  });
});
