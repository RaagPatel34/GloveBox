import { describe, expect, it } from "vitest";
import { buildSnapshot, parseGeocodeResult, parseSetupInput } from "./setup";
import { NOW } from "./test-support";

const A = "3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const valid = {
  visitorId: A,
  epaVehicleId: "40848",
  odometer: "48,000",
  weeklyMiles: "250",
  mpgOverride: "",
  home: "Buena Park, CA",
};

describe("parseSetupInput", () => {
  it("reads a complete form, tolerating thousands separators and an empty override", () => {
    expect(parseSetupInput(form(valid))).toEqual({
      ok: true,
      value: {
        visitorId: A,
        epaVehicleId: "40848",
        odometer: 48_000,
        weeklyMiles: 250,
        mpgOverride: undefined,
        home: "Buena Park, CA",
      },
    });
  });

  it("keeps a numeric MPG override", () => {
    const result = parseSetupInput(form({ ...valid, mpgOverride: "31.5" }));
    expect(result.ok && result.value.mpgOverride).toBe(31.5);
  });

  it("reports a message per bad field", () => {
    const result = parseSetupInput(
      form({ visitorId: "nope", epaVehicleId: "abc", odometer: "-5", weeklyMiles: "x", mpgOverride: "0", home: " " }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["epaVehicleId", "home", "mpgOverride", "odometer", "visitorId", "weeklyMiles"],
    );
  });

  it("rejects absurd odometers and weekly miles", () => {
    const result = parseSetupInput(form({ ...valid, odometer: "9999999", weeklyMiles: "5000" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["odometer", "weeklyMiles"]);
  });
});

describe("parseGeocodeResult", () => {
  // From the live Nominatim API for "Buena Park CA".
  const buenaPark = [
    {
      lat: "33.8704130",
      lon: "-117.9962165",
      name: "Buena Park",
      display_name: "Buena Park, Orange County, California, United States",
      address: { town: "Buena Park", county: "Orange County", state: "California", country_code: "us" },
    },
  ];

  it("returns coordinates and a short label", () => {
    expect(parseGeocodeResult(buenaPark)).toEqual({
      lat: 33.870413,
      lng: -117.9962165,
      label: "Buena Park, California",
    });
  });

  it("returns null when nothing matched", () => {
    expect(parseGeocodeResult([])).toBeNull();
    expect(parseGeocodeResult(null)).toBeNull();
    expect(parseGeocodeResult([{ lat: "x", lon: "y" }])).toBeNull();
  });
});

describe("buildSnapshot", () => {
  it("builds the vehicle (EPA numbers from the lookup, not the form) and its 8 baseline items", () => {
    let n = 0;
    const snapshot = buildSnapshot({
      input: {
        visitorId: A,
        epaVehicleId: "40848",
        odometer: 48_000,
        weeklyMiles: 250,
        mpgOverride: 31,
        home: "Buena Park, CA",
      },
      epa: {
        epaVehicleId: "40848",
        year: 2019,
        make: "Honda",
        model: "Civic 4Dr",
        combinedMpg: 33,
        fuelType: "Regular Gasoline",
      },
      home: { lat: 33.87, lng: -117.99, label: "Buena Park, California" },
      now: NOW,
      newId: () => `id-${++n}`,
    });

    expect(snapshot.vehicle).toEqual({
      id: "id-1",
      visitorId: A,
      year: 2019,
      make: "Honda",
      model: "Civic 4Dr",
      epaMpg: 33,
      mpgOverride: 31,
      odometer: 48_000,
      weeklyMiles: 250,
      home: { lat: 33.87, lng: -117.99, label: "Buena Park, California" },
    });
    expect(snapshot.readingAt).toBe(NOW.toISOString());
    expect(snapshot.items).toHaveLength(8);
    expect(snapshot.items.every((i) => i.vehicleId === "id-1")).toBe(true);
  });
});
