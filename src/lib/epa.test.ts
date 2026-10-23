import { describe, expect, it } from "vitest";
import { createEpaClient, parseMenu, parseVehicleDetail } from "./epa";

// Response bodies below are copied from the live fueleconomy.gov API (Accept: application/json).

describe("parseMenu", () => {
  it("reads a list of options", () => {
    const body = {
      menuItem: [
        { text: "Auto (AV-S7), 4 cyl, 1.5 L, Turbo", value: "40844" },
        { text: "Man 6-spd, 4 cyl, 2.0 L", value: "40846" },
      ],
    };
    expect(parseMenu(body)).toEqual([
      { text: "Auto (AV-S7), 4 cyl, 1.5 L, Turbo", value: "40844" },
      { text: "Man 6-spd, 4 cyl, 2.0 L", value: "40846" },
    ]);
  });

  it("treats the single-option object form as a one-item list", () => {
    expect(parseMenu({ menuItem: { text: "Auto (A1)", value: "41185" } })).toEqual([
      { text: "Auto (A1)", value: "41185" },
    ]);
  });

  it("treats the null body (no matches) as an empty list", () => {
    expect(parseMenu(null)).toEqual([]);
  });

  it("drops entries that are not text/value pairs", () => {
    expect(parseMenu({ menuItem: [{ text: "ok", value: "1" }, { text: 3 }, null] })).toEqual([
      { text: "ok", value: "1" },
    ]);
  });
});

describe("parseVehicleDetail", () => {
  // Trimmed from /vehicle/40367 (2019 Porsche 911 Turbo Cabriolet).
  const porsche = {
    id: "40367",
    year: "2019",
    make: "Porsche",
    model: "911 Turbo Cabriolet",
    comb08: "21",
    fuelType1: "Premium Gasoline",
  };

  it("returns the identity and the EPA combined MPG as numbers", () => {
    expect(parseVehicleDetail(porsche)).toEqual({
      epaVehicleId: "40367",
      year: 2019,
      make: "Porsche",
      model: "911 Turbo Cabriolet",
      combinedMpg: 21,
      fuelType: "Premium Gasoline",
    });
  });

  it("rejects a record without a usable combined MPG", () => {
    expect(parseVehicleDetail({ ...porsche, comb08: "0" })).toBeNull();
    expect(parseVehicleDetail({ ...porsche, comb08: "n/a" })).toBeNull();
    expect(parseVehicleDetail(null)).toBeNull();
  });
});

describe("createEpaClient", () => {
  function fakeFetch(routes: Record<string, unknown>) {
    const calls: string[] = [];
    const fn = async (url: string | URL | Request) => {
      const href = String(url);
      calls.push(href);
      const key = Object.keys(routes).find((k) => href.endsWith(k));
      if (key === undefined) return new Response("nope", { status: 404 });
      return Response.json(routes[key]);
    };
    return { fn, calls };
  }

  it("lists makes for a year, from the fueleconomy.gov REST API", async () => {
    const { fn, calls } = fakeFetch({
      "/menu/make?year=2019": { menuItem: [{ text: "Honda", value: "Honda" }] },
    });
    const epa = createEpaClient(fn);
    expect(await epa.makes(2019)).toEqual([{ text: "Honda", value: "Honda" }]);
    expect(calls[0]).toBe("https://www.fueleconomy.gov/ws/rest/vehicle/menu/make?year=2019");
  });

  it("encodes model names that contain spaces and slashes", async () => {
    const { fn, calls } = fakeFetch({
      "/menu/options?year=2019&make=Honda&model=Accord+2.0T+Sport%2FTouring": null,
    });
    const epa = createEpaClient(fn);
    expect(await epa.options(2019, "Honda", "Accord 2.0T Sport/Touring")).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("looks up the combined MPG for a chosen option", async () => {
    const { fn } = fakeFetch({
      "/vehicle/40848": {
        id: "40848",
        year: "2019",
        make: "Honda",
        model: "Civic 4Dr",
        comb08: "33",
        fuelType1: "Regular Gasoline",
      },
    });
    const epa = createEpaClient(fn);
    expect((await epa.vehicle("40848"))?.combinedMpg).toBe(33);
  });

  it("returns null for an unknown vehicle id and throws on server errors", async () => {
    const notFound = createEpaClient(async () => new Response("", { status: 404 }));
    expect(await notFound.vehicle("1")).toBeNull();
    const broken = createEpaClient(async () => new Response("", { status: 500 }));
    await expect(broken.makes(2019)).rejects.toThrow(/fueleconomy/i);
  });
});
