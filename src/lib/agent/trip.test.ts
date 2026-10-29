import { describe, expect, it } from "vitest";
import type { Place } from "../maps";
import type { LatLng } from "../types";
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
  const calls: { findPlace: string[]; route: LatLng[][] } = { findPlace: [], route: [] };
  const services: TripServices = {
    findPlace: async (query) => {
      calls.findPlace.push(query);
      return PLACES[query.toLowerCase()] ?? null;
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
});
