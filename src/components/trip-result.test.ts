import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GasPrice, TripDetour, TripPlan } from "@/lib/types";
import { TripResult } from "./trip-result";

const home = { label: "Buena Park, CA", lat: 33.86, lng: -118 };
const eia: GasPrice = { price: 4.712, source: "https://www.eia.gov/petroleum/gasdiesel/", asOf: "2026-10-20", kind: "eia", label: "Los Angeles weekly regular gasoline average" };
const cheap: GasPrice = { price: 4.19, source: "https://www.gasbuddy.com/station/111", asOf: "2026-10-28T22:15:00Z", kind: "station" };
const usual: GasPrice = { price: 4.59, source: "https://www.gasbuddy.com/station/222", asOf: "2026-10-28T20:00:00Z", kind: "station" };

const plan = (over: Partial<TripPlan> = {}): TripPlan => ({
  stops: [{ type: "gas", label: "7000 Beach Blvd", name: "Arco", lat: 33.85, lng: -117.99 }],
  totalMiles: 6.2,
  totalMinutes: 14,
  fuelCost: 0.97,
  gasPrice: eia,
  model: "super",
  mapsUrl: "https://www.google.com/maps/dir/?api=1",
  ...over,
});

const detour = (over: Partial<TripDetour> = {}): TripDetour => ({
  station: "Arco",
  price: cheap,
  usual: { station: "Chevron", price: usual },
  savings: 4,
  detourCost: 0.73,
  net: 3.27,
  worthIt: true,
  extraMiles: 4.5,
  gallons: 10,
  ...over,
});

const render = (trip: TripPlan) => renderToStaticMarkup(createElement(TripResult, { trip, home, mpg: 29 }));

describe("TripResult", () => {
  it("says a regional price is not a station quote, and links its source by name", () => {
    const html = render(plan());
    expect(html).toContain("A regional average, not a station quote.");
    expect(html).toContain("EIA weekly prices");
    expect(html).not.toContain("EIA source");
  });

  it("drops the regional caveat when the price is a station's", () => {
    const html = render(plan({ gasPrice: cheap }));
    expect(html).not.toContain("not a station quote");
    expect(html).toContain("Station price");
    expect(html).toContain("gasbuddy.com");
  });

  it("shows no verdict when there was no cheaper station to weigh", () => {
    expect(render(plan())).not.toContain("the detour");
  });

  it("gives a worth-it verdict with both stations, their prices and the route through the cheaper one", () => {
    const html = render(plan({ gasPrice: cheap, model: "ultra", detour: detour() }));
    expect(html).toContain("Worth the detour");
    expect(html).toContain("The route already goes through Arco");
    expect(html).toContain("Chevron");
    expect(html).toContain("$4.190");
    expect(html).toContain("$4.590");
    expect(html).toContain("$3.27");
    expect(html).toContain("4.5");
    expect(html).toMatch(/>10<\/span> gal/);
    expect(html).toContain("Ultra");
  });

  it("says to skip a detour that costs more than it saves, and keeps the usual route", () => {
    const html = render(plan({ gasPrice: usual, model: "ultra", detour: detour({ savings: 0.4, detourCost: 0.9, net: -0.5, worthIt: false }) }));
    expect(html).toContain("Skip the detour");
    expect(html).not.toContain("already goes through");
    expect(html).toContain("$0.50");
  });
});
