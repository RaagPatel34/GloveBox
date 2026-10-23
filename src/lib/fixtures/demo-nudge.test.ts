import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NOW } from "../test-support";
import { demoCar } from "./demo-car";
import { demoNudge } from "./demo-nudge";

const VISITOR = "11111111-2222-4333-8444-555555555555";
const DATES = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"];

const dryForecast = {
  daily: {
    time: DATES,
    precipitation_probability_max: DATES.map(() => 1),
    precipitation_sum: DATES.map(() => 0),
  },
};
const clearAir = {
  current: { time: "2026-10-22T05:00", pm2_5: 8.8, us_aqi: 40 },
  hourly: { time: ["2026-10-22T05:00"], pm2_5: [8.8] },
};

const car = demoCar(NOW, VISITOR, randomUUID);

function fetchOf(forecast: unknown, air: unknown) {
  return async (url: string) => {
    const body = url.includes("air-quality-api") ? air : forecast;
    if (body instanceof Error) throw body;
    return Response.json(body);
  };
}

describe("demoNudge", () => {
  it("seeds a nudge from the real forecast, for the demo car, created now", async () => {
    const nudge = await demoNudge(car, NOW, randomUUID, fetchOf(dryForecast, clearAir));
    expect(nudge).toMatchObject({
      vehicleId: car.vehicle.id,
      text: "Dry all week, a good time to wash.",
      createdAt: NOW.toISOString(),
    });
    expect(nudge.reason).toContain("Open-Meteo");
  });

  it("gives every load a fresh id", async () => {
    const fetchImpl = fetchOf(dryForecast, clearAir);
    const [a, b] = [await demoNudge(car, NOW, randomUUID, fetchImpl), await demoNudge(car, NOW, randomUUID, fetchImpl)];
    expect(a.id).not.toBe(b.id);
  });

  it("says plainly that it could not check, when Open-Meteo is unreachable, instead of inventing a forecast", async () => {
    const down = new Error("offline");
    const nudge = await demoNudge(car, NOW, randomUUID, fetchOf(down, down));
    expect(nudge.vehicleId).toBe(car.vehicle.id);
    expect(nudge.text).toBe("Check the forecast before you wash.");
    expect(nudge.reason).toMatch(/could not be reached/);
    expect(nudge.reason).toMatch(/not a real forecast/);
  });

  it("does the same when only one of the two services is down and the other had nothing to say", async () => {
    const nudge = await demoNudge(car, NOW, randomUUID, fetchOf(new Error("offline"), clearAir));
    expect(nudge.reason).toMatch(/not a real forecast/);
  });

  it("keeps a real nudge when one service is down but the other had something to say", async () => {
    const smoky = { ...clearAir, current: { ...clearAir.current, pm2_5: 90 } };
    const nudge = await demoNudge(car, NOW, randomUUID, fetchOf(new Error("offline"), smoky));
    expect(nudge.text).toMatch(/^Smoky air/);
  });
});
