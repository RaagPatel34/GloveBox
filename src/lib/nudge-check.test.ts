import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { demoCar } from "./fixtures/demo-car";
import { checkConditions } from "./nudge-check";
import { NOW } from "./test-support";

const VISITOR = "11111111-2222-4333-8444-555555555555";

// Shaped like the live Open-Meteo bodies (see weather.test.ts); one day of rain is optional.
function forecastBody(rainOnDay?: number) {
  const dates = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"];
  return {
    daily: {
      time: dates,
      precipitation_probability_max: dates.map((_, i) => (i === rainOnDay ? 85 : 2)),
      precipitation_sum: dates.map((_, i) => (i === rainOnDay ? 0.31 : 0)),
    },
  };
}

function airBody(pm25: number) {
  return {
    current: { time: "2026-10-22T05:00", pm2_5: pm25, us_aqi: 40 },
    hourly: { time: ["2026-10-22T05:00", "2026-10-22T06:00"], pm2_5: [pm25, pm25] },
  };
}

// Answers each Open-Meteo API from `routes`; an `Error` makes that API unreachable.
function fakeFetch(routes: { forecast: unknown; air: unknown }) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const body = url.includes("air-quality-api") ? routes.air : routes.forecast;
    if (body instanceof Error) throw body;
    return Response.json(body);
  };
  return { fn, calls };
}

describe("checkConditions", () => {
  const car = demoCar(NOW, VISITOR, randomUUID);

  it("looks up the weather and air at the car's home", async () => {
    const { fn, calls } = fakeFetch({ forecast: forecastBody(), air: airBody(8) });
    await checkConditions(car, NOW, fn);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(new URL(call).searchParams.get("latitude")).toBe(String(car.vehicle.home.lat));
      expect(new URL(call).searchParams.get("longitude")).toBe(String(car.vehicle.home.lng));
    }
  });

  it("holds an overdue wash for rain, naming the car's place in the reason", async () => {
    const { fn } = fakeFetch({ forecast: forecastBody(2), air: airBody(8) });
    const result = await checkConditions(car, NOW, fn);
    expect(result.complete).toBe(true);
    expect(result.nudge?.text).toBe("Rain Saturday, wash Sunday.");
    expect(result.nudge?.reason).toContain("Knott's Berry Farm, Buena Park, CA");
  });

  it("suggests a wash and a filter check for smoke", async () => {
    const { fn } = fakeFetch({ forecast: forecastBody(), air: airBody(80) });
    expect((await checkConditions(car, NOW, fn)).nudge?.text).toMatch(/cabin air filter/);
  });

  it("gives no nudge when the wash is not due and the air is clear", async () => {
    const washedToday = {
      ...car,
      items: car.items.map((i) => (i.kind === "wash" ? { ...i, lastDoneAt: NOW.toISOString(), dueAt: new Date(NOW.getTime() + 14 * 86_400_000).toISOString() } : i)),
    };
    const { fn } = fakeFetch({ forecast: forecastBody(2), air: airBody(8) });
    expect(await checkConditions(washedToday, NOW, fn)).toEqual({ nudge: null, complete: true });
  });

  it("still finds smoke when the forecast is unreachable, and says the check was incomplete", async () => {
    const { fn } = fakeFetch({ forecast: new Error("offline"), air: airBody(80) });
    const result = await checkConditions(car, NOW, fn);
    expect(result.nudge?.text).toMatch(/^Smoky air/);
    expect(result.complete).toBe(false);
  });

  it("still finds rain when the air service is unreachable, and says the check was incomplete", async () => {
    const { fn } = fakeFetch({ forecast: forecastBody(1), air: new Error("offline") });
    const result = await checkConditions(car, NOW, fn);
    expect(result.nudge?.text).toMatch(/^Rain tomorrow/);
    expect(result.complete).toBe(false);
  });

  it("does not throw when neither service is reachable", async () => {
    const { fn } = fakeFetch({ forecast: new Error("offline"), air: new Error("offline") });
    expect(await checkConditions(car, NOW, fn)).toEqual({ nudge: null, complete: false });
  });

  it("treats an unreadable answer like an unreachable service", async () => {
    const { fn } = fakeFetch({ forecast: { error: true, reason: "bad request" }, air: airBody(8) });
    expect(await checkConditions(car, NOW, fn)).toEqual({ nudge: null, complete: false });
  });
});
