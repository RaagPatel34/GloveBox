import { describe, expect, it } from "vitest";
import { loopRouteRequest, parsePlace } from "./maps";
import { parseRoute } from "./route-planner";
import { parseRegionalPrice, EIA_AREAS } from "./gas-price";

// Shapes copied from real Places (New), Routes and EIA v2 responses, October 2026.
const traderJoes = {
  places: [
    {
      id: "ChIJXwqz7v4s3YARmP3VNE9pDd0",
      formattedAddress: "12861 Towne Center Dr, Cerritos, CA 90703",
      location: { latitude: 33.868987499999996, longitude: -118.05796289999999 },
      displayName: { text: "Trader Joe's", languageCode: "en" },
    },
  ],
};

describe("parsePlace", () => {
  it("reads the first match's name, address and coordinates", () => {
    expect(parsePlace(traderJoes)).toEqual({
      name: "Trader Joe's",
      label: "12861 Towne Center Dr, Cerritos, CA 90703",
      lat: 33.868987499999996,
      lng: -118.05796289999999,
    });
  });

  it("finds nothing when Places has no match", () => {
    expect(parsePlace({})).toBeNull();
    expect(parsePlace({ places: [] })).toBeNull();
  });

  it("treats a match without usable coordinates as no match, not a point at 0,0", () => {
    const place = traderJoes.places[0];
    expect(parsePlace({ places: [{ ...place, location: undefined }] })).toBeNull();
    expect(parsePlace({ places: [{ ...place, location: { latitude: 91, longitude: 0 } }] })).toBeNull();
    expect(parsePlace({ places: [{ ...place, formattedAddress: "" }] })).toBeNull();
  });
});

describe("loopRouteRequest", () => {
  const home = { lat: 33.8675, lng: -117.9981 };
  const stops = [
    { lat: 33.869, lng: -118.058 },
    { lat: 33.7493, lng: -117.8733 },
  ];

  it("starts and ends at home with every stop in between, reorderable", () => {
    const request = loopRouteRequest(home, stops);
    const latLng = { latitude: 33.8675, longitude: -117.9981 };
    expect(request.origin).toEqual({ location: { latLng } });
    expect(request.destination).toEqual({ location: { latLng } });
    expect(request.intermediates).toEqual([
      { location: { latLng: { latitude: 33.869, longitude: -118.058 } } },
      { location: { latLng: { latitude: 33.7493, longitude: -117.8733 } } },
    ]);
    expect(request.optimizeWaypointOrder).toBe(true);
  });

  it("does not ask to optimize a single stop, which Routes answers with order [-1]", () => {
    expect(loopRouteRequest(home, stops.slice(0, 1)).optimizeWaypointOrder).toBe(false);
  });
});

describe("parseRoute", () => {
  it("puts any kind of stop in the provider's order and converts meters and seconds", () => {
    const route = parseRoute(
      { routes: [{ distanceMeters: 53115, duration: "2943s", optimizedIntermediateWaypointIndex: [1, 0] }] },
      [{ name: "wash" }, { name: "gas" }],
      true,
    );
    expect(route.order).toEqual([{ name: "gas" }, { name: "wash" }]);
    expect(route.miles).toBeCloseTo(33.004, 3);
    expect(route.minutes).toBeCloseTo(49.05, 2);
  });

  it("keeps the given order when not optimizing", () => {
    const route = parseRoute({ routes: [{ distanceMeters: 15407, duration: "1110s", optimizedIntermediateWaypointIndex: [-1] }] }, ["only"], false);
    expect(route.order).toEqual(["only"]);
  });

  it("refuses a missing route or a broken order instead of inventing one", () => {
    expect(() => parseRoute({}, ["a"], false)).toThrow();
    expect(() => parseRoute({ routes: [{ distanceMeters: 1000, duration: "20s", optimizedIntermediateWaypointIndex: [0] }] }, ["a", "b"], true)).toThrow();
  });
});

describe("parseRegionalPrice for Los Angeles", () => {
  const body = { response: { data: [{ period: "2026-10-26", series: "EMM_EPMR_PTE_Y05LA_DPG", value: "5.883", units: "$/GAL" }] } };

  it("labels the Los Angeles weekly average with its own EIA source page", () => {
    const price = parseRegionalPrice(body, new Date("2026-10-28T12:00:00Z"), EIA_AREAS.la);
    expect(price).toEqual({
      price: 5.883,
      asOf: "2026-10-26",
      source: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_Y05LA_DPG&f=W",
      kind: "eia",
      label: "Los Angeles weekly regular gasoline average",
      stale: false,
    });
  });

  it("still defaults to the California average", () => {
    expect(parseRegionalPrice(body, new Date("2026-10-28T12:00:00Z")).label).toBe("California weekly regular gasoline average");
  });
});
