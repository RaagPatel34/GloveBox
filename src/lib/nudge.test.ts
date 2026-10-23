import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { demoCar } from "./fixtures/demo-car";
import { evaluateNudge, NUDGE_TTL_MS, nudgeCutoff, washChanged } from "./nudge";
import { inDays, NOW } from "./test-support";
import type { AirQuality, WeatherForecast } from "./weather";

const PLACE = "Knott's Berry Farm, Buena Park, CA";

// 2026-10-22 is a Thursday.
const DATES = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"];

// A week of forecast, dry unless a day is listed: day index -> [chance %, inches].
function week(rainy: Record<number, [number, number]> = {}): WeatherForecast {
  return {
    days: DATES.map((date, i) => {
      const [rainChance, rainInches] = rainy[i] ?? [3, 0];
      return { date, rainChance, rainInches };
    }),
  };
}

const clearAir: AirQuality = { asOf: "2026-10-22T09:00", pm25Now: 8, pm25Peak24h: 12, usAqi: 33 };
const smokyAir: AirQuality = { asOf: "2026-10-22T09:00", pm25Now: 61.3, pm25Peak24h: 74.1, usAqi: 154 };

const input = (over: Partial<Parameters<typeof evaluateNudge>[0]> = {}) => ({
  weather: week(),
  air: clearAir,
  washStatus: "overdue" as const,
  place: PLACE,
  ...over,
});

describe("evaluateNudge: rain", () => {
  it("holds the wash when rain is coming, and names the first dry day", () => {
    const nudge = evaluateNudge(input({ weather: week({ 2: [85, 0.31] }) }));
    expect(nudge?.text).toBe("Rain Saturday, wash Sunday.");
  });

  it("gives the reason: how much rain, how likely, where, and why it matters", () => {
    const nudge = evaluateNudge(input({ weather: week({ 2: [85, 0.31] }) }));
    expect(nudge?.reason).toBe(
      "Open-Meteo forecasts 0.31 in of rain on Saturday (85% chance) near Knott's Berry Farm, Buena Park, CA. " +
        "The wash is overdue, but rain would undo it.",
    );
  });

  it("says today and tomorrow instead of the weekday", () => {
    expect(evaluateNudge(input({ weather: week({ 0: [90, 0.2] }) }))?.text).toBe("Rain today, wash tomorrow.");
    expect(evaluateNudge(input({ weather: week({ 1: [90, 0.2] }) }))?.text).toBe("Rain tomorrow, wash Saturday.");
  });

  it("waits out a run of rainy days", () => {
    const nudge = evaluateNudge(input({ weather: week({ 1: [70, 0.2], 2: [90, 0.5] }) }));
    expect(nudge?.text).toBe("Rain tomorrow through Saturday, wash Sunday.");
    expect(nudge?.reason).toContain("0.70 in of rain tomorrow through Saturday (90% chance)");
  });

  it("holds the wash until it clears when the rain runs past the forecast", () => {
    const rain = Object.fromEntries([2, 3, 4, 5, 6].map((i) => [i, [80, 0.3]])) as Record<number, [number, number]>;
    expect(evaluateNudge(input({ weather: week(rain) }))?.text).toBe(
      "Rain Saturday through Wednesday, hold the wash until it clears.",
    );
  });

  it("also applies when the wash is only due soon", () => {
    expect(evaluateNudge(input({ washStatus: "due_soon", weather: week({ 1: [80, 0.2] }) }))?.text).toMatch(/^Rain tomorrow/);
  });

  it("says nothing about rain when the wash is not due", () => {
    expect(evaluateNudge(input({ washStatus: "ok", weather: week({ 1: [80, 0.2] }) }))).toBeNull();
  });

  it("ignores rain more than 3 days out: wash first", () => {
    const nudge = evaluateNudge(input({ weather: week({ 4: [90, 0.4] }) }));
    expect(nudge?.text).toBe("Dry until Monday, a good time to wash.");
  });

  it("ignores a stray drizzle or a long-shot chance of rain", () => {
    // The shapes of real days: 0.012 in at 0% chance, and 0.3 in at only 20%.
    expect(evaluateNudge(input({ washStatus: "ok", weather: week({ 1: [0, 0.012], 2: [20, 0.3] }) }))).toBeNull();
    expect(evaluateNudge(input({ weather: week({ 1: [0, 0.012] }) }))?.text).toMatch(/good time to wash/);
  });

  it("counts rain with no chance given if there is enough of it", () => {
    const weather = week();
    weather.days[1] = { date: "2026-10-23", rainChance: null, rainInches: 0.25 };
    expect(evaluateNudge(input({ weather }))?.text).toMatch(/^Rain tomorrow/);
  });
});

describe("evaluateNudge: dry window", () => {
  it("suggests washing an overdue car when nothing is coming", () => {
    const nudge = evaluateNudge(input());
    expect(nudge?.text).toBe("Dry all week, a good time to wash.");
    expect(nudge?.reason).toBe(
      "No rain in Open-Meteo's forecast through Wednesday near Knott's Berry Farm, Buena Park, CA, and the wash is overdue.",
    );
  });

  it("does not claim a dry week from a forecast that stops early", () => {
    const short = { days: week().days.slice(0, 3) };
    expect(evaluateNudge(input({ weather: short }))?.text).toBe("Dry through Saturday, a good time to wash.");
  });

  it("words a due-soon wash as due soon", () => {
    expect(evaluateNudge(input({ washStatus: "due_soon" }))?.reason).toMatch(/and the wash is due soon\.$/);
  });

  it("says nothing when the wash is fine and the sky is clear", () => {
    expect(evaluateNudge(input({ washStatus: "ok" }))).toBeNull();
  });

  it("says nothing when the car has no wash item and the sky is clear", () => {
    expect(evaluateNudge(input({ washStatus: undefined }))).toBeNull();
  });
});

describe("evaluateNudge: smoke", () => {
  it("suggests a wash and a cabin air filter check when PM2.5 is high", () => {
    const nudge = evaluateNudge(input({ air: smokyAir, washStatus: "ok" }));
    expect(nudge?.text).toBe("Smoky air: rinse the ash off soon and check the cabin air filter.");
  });

  it("gives the reading and the threshold as the reason", () => {
    const nudge = evaluateNudge(input({ air: smokyAir }));
    expect(nudge?.reason).toBe(
      "PM2.5 is 61 µg/m³ now and may reach 74 over the next 24 hours near Knott's Berry Farm, Buena Park, CA (US AQI 154). " +
        "From 35.5 µg/m³ up the air is unhealthy for sensitive people, and smoke carries ash and fine particles that dirty paint and cabin filters.",
    );
  });

  it("acts on smoke that is forecast but not here yet, without telling you to rinse ash that has not fallen", () => {
    const nudge = evaluateNudge(input({ air: { ...clearAir, pm25Peak24h: 48 }, washStatus: "ok" }));
    expect(nudge?.text).toBe("Smoke expected: check the cabin air filter, and rinse the ash off once the air clears.");
    expect(nudge?.reason).toContain("PM2.5 is 8 µg/m³ now and may reach 48 over the next 24 hours");
  });

  it("leaves out the AQI when it is not reported", () => {
    expect(evaluateNudge(input({ air: { ...smokyAir, usAqi: null } }))?.reason).not.toContain("US AQI");
  });

  it("does not call ordinary city air smoke", () => {
    expect(evaluateNudge(input({ air: { ...clearAir, pm25Peak24h: 35.4 }, washStatus: "ok" }))).toBeNull();
  });

  it("comes before the weather: smoke is the more urgent of the two", () => {
    const nudge = evaluateNudge(input({ air: smokyAir, weather: week({ 1: [90, 0.4] }) }));
    expect(nudge?.text).toMatch(/^Smoky air/);
  });
});

describe("evaluateNudge: data missing", () => {
  it("still finds smoke without a forecast", () => {
    expect(evaluateNudge(input({ weather: undefined, air: smokyAir }))?.text).toMatch(/^Smoky air/);
  });

  it("still finds rain without an air reading", () => {
    expect(evaluateNudge(input({ air: undefined, weather: week({ 1: [80, 0.2] }) }))?.text).toMatch(/^Rain tomorrow/);
  });

  it("says nothing with neither", () => {
    expect(evaluateNudge(input({ weather: undefined, air: undefined }))).toBeNull();
  });
});

describe("nudgeCutoff", () => {
  it("is the moment a nudge made now would stop being shown, counted back from `now`", () => {
    expect(nudgeCutoff(NOW).toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(NOW.getTime() - nudgeCutoff(NOW).getTime()).toBe(NUDGE_TTL_MS);
  });
});

describe("washChanged", () => {
  const before = demoCar(NOW, "11111111-2222-4333-8444-555555555555", randomUUID);
  const withItems = (change: (item: (typeof before.items)[number]) => (typeof before.items)[number]) => ({
    ...before,
    items: before.items.map(change),
  });

  it("is true when the wash was logged", () => {
    const after = withItems((i) => (i.kind === "wash" ? { ...i, lastDoneAt: NOW.toISOString(), dueAt: inDays(14) } : i));
    expect(washChanged(before, after)).toBe(true);
  });

  it("is true when the wash's due date was moved", () => {
    expect(washChanged(before, withItems((i) => (i.kind === "wash" ? { ...i, dueAt: inDays(30) } : i)))).toBe(true);
  });

  it("is false when only other items or the odometer changed", () => {
    const after = withItems((i) => (i.kind === "oil" ? { ...i, lastDoneAt: NOW.toISOString(), dueAt: inDays(90) } : i));
    expect(washChanged(before, after)).toBe(false);
    expect(washChanged(before, { ...before, vehicle: { ...before.vehicle, odometer: before.vehicle.odometer + 40 } })).toBe(false);
  });
});
