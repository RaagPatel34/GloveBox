import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TripResult } from "@/components/trip-result";
import { planTrip } from "../agent/trip";
import { callTools, say, scriptedChat } from "../agent/scripted-chat";
import { demoCar } from "./demo-car";
import { DEMO_ERRAND_STOPS, DEMO_PRICE_SOURCE, demoTripServices } from "./demo-trip";

// The demo errand end to end (#15): three gas stations near the demo car's home put the trip on
// Ultra, which prices them and weighs the cheapest; code says whether the detour pays.

const car = demoCar(new Date("2026-10-29T12:00:00Z"), "visitor", () => "id");
const home = car.vehicle.home;
const mpg = car.vehicle.epaMpg;

const CHEVRON = "7501 Beach Blvd, Buena Park, CA 90620";
const ARCO = "6401 Orangethorpe Ave, Buena Park, CA 90620";
const SHELL = "1500 S Beach Blvd, Anaheim, CA 92804";

const ultraSteps = () => [
  callTools(
    ["findNearby", { type: "gas" }],
    ["findNearby", { type: "wash" }],
    ["geocode", { query: "Trader Joe's, Santa Ana, CA" }],
    ["getGasPrice", {}],
  ),
  callTools(["computeRoute", {}]),
  callTools(["getStationPrice", { station: CHEVRON }], ["getStationPrice", { station: ARCO }], ["getStationPrice", { station: SHELL }]),
  callTools(["checkDetour", { station: ARCO }]),
];

async function planDemo() {
  const chat = scriptedChat({ ultra: ultraSteps() });
  const reply = await planTrip({ stops: DEMO_ERRAND_STOPS, home, mpg, chat, services: demoTripServices().services, ultra: true });
  return { reply, chat };
}

describe("the demo errand, end to end", () => {
  it("runs on Ultra and finds the cheaper Arco worth the detour on a 10-gallon fill-up", async () => {
    const { reply, chat } = await planDemo();

    expect(chat.requests.every((r) => r.tier === "ultra")).toBe(true);
    expect(reply.model).toBe("ultra");
    const plan = reply.plan!;
    expect(plan.model).toBe("ultra");
    expect(plan.detour).toMatchObject({ station: "Arco", usual: { station: "Chevron" }, worthIt: true, gallons: 10 });
    // Arco $4.899 against Chevron's $5.199: 10 gal × $0.30 = $3.00 saved. The loop through
    // Arco is 26.4 mi against 24.1 through Chevron: 2.3 mi ÷ 34 MPG × $5.199 ≈ $0.35 to get there.
    expect(plan.detour!.extraMiles).toBeCloseTo(2.3, 5);
    expect(plan.detour!.savings).toBeCloseTo(3, 5);
    expect(plan.detour!.detourCost).toBeCloseTo(0.3517, 3);
    expect(plan.detour!.net).toBeCloseTo(2.648, 3);
    // Worth it, so the drive goes through Arco and the fuel is bought at its price.
    expect(plan.stops.map((s) => `${s.type}: ${s.name}`)).toEqual(["gas: Arco", "wash: Mister Car Wash", "address: Trader Joe's"]);
    expect(plan.totalMiles).toBeCloseTo(26.4, 5);
    expect(plan.gasPrice.price).toBe(4.899);
    // 26.4 mi ÷ 34 MPG × $4.899
    expect(plan.fuelCost).toBeCloseTo(3.804, 3);
  });

  it("gives every price its source, date and kind, and marks the station prices as demo figures", async () => {
    const plan = (await planDemo()).reply.plan!;

    const prices = [plan.gasPrice, plan.detour!.price, plan.detour!.usual.price];
    for (const price of prices) {
      expect(price.source).toBeTruthy();
      expect(Number.isNaN(Date.parse(price.asOf))).toBe(false);
      expect(price.kind).toBe("station");
      // An invented price must never pass for a real station's quote or link to one.
      expect(price.source).toMatch(/demo/i);
      expect(price.source).not.toMatch(/^https?:/);
      expect(price.label).toMatch(/demo/i);
    }
  });

  it("shows the verdict, the Ultra badge and the demo label in the trip result", async () => {
    const plan = (await planDemo()).reply.plan!;

    const html = renderToStaticMarkup(createElement(TripResult, { trip: plan, home, mpg }));

    expect(html).toContain("Worth the detour");
    expect(html).toContain("Ultra");
    expect(html).toContain("$4.899");
    expect(html).toContain("$5.199");
    expect(html).toContain("$2.65");
    // Each shown price (the fuel's, and both stations' in the verdict) names its demo source.
    expect(html.split(DEMO_PRICE_SOURCE)).toHaveLength(4);
    expect(html).not.toMatch(/gasbuddy|chevron\.com|arco\.com/i);
  });

  it("stays on Super with no verdict when only one gas station is near home", async () => {
    // From Santa Ana, the only station within reach is the 76.
    const santaAna = { lat: 33.7455, lng: -117.8677, label: "Santa Ana, CA" };
    const chat = scriptedChat({
      super: [callTools(["findNearby", { type: "gas" }], ["getGasPrice", {}]), callTools(["computeRoute", {}])],
    });

    const reply = await planTrip({ stops: [{ type: "gas" }], home: santaAna, mpg, chat, services: demoTripServices().services, ultra: true });

    expect(chat.requests.map((r) => r.tier)).toEqual(["super", "super"]);
    expect(reply.model).toBe("super");
    expect(reply.plan?.model).toBe("super");
    expect(reply.plan?.detour).toBeUndefined();
    expect(reply.plan?.gasPrice.kind).toBe("eia");
  });

  it("says so, rather than inventing a verdict, when Ultra finds no cheaper station to check", async () => {
    const chat = scriptedChat({ ultra: [...ultraSteps().slice(0, 2), say("No station prices to compare.")] });

    const reply = await planTrip({ stops: DEMO_ERRAND_STOPS, home, mpg, chat, services: demoTripServices().services, ultra: true });

    expect(reply.plan?.model).toBe("ultra");
    expect(reply.plan?.detour).toBeUndefined();
    expect(reply.plan?.stops[0].name).toBe("Chevron");
  });
});
