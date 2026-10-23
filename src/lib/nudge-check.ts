import { estimateCarOdometer, itemStatus } from "./intervals";
import { evaluateNudge, type NudgeDraft } from "./nudge";
import type { CarSnapshot } from "./types";
import { getAirQuality, getWeather } from "./weather";

// Checks the real weather and air at the car's home against the nudge rules.
// Used by "Load demo car" now and by the daily job (#16) later.

export type ConditionsCheck = {
  nudge: NudgeDraft | null;
  // False when a weather service could not be reached or read. "No nudge" then means "could
  // not tell", not "nothing to say": the caller decides whether that matters.
  complete: boolean;
};

type FetchLike = (url: string) => Promise<Response>;

// Never throws: a service that is down just leaves its half out.
export async function checkConditions(car: CarSnapshot, now: Date, fetchImpl?: FetchLike): Promise<ConditionsCheck> {
  const { home } = car.vehicle;
  const [weather, air] = await Promise.allSettled([getWeather(home, fetchImpl), getAirQuality(home, fetchImpl)]);

  for (const result of [weather, air]) {
    if (result.status === "rejected") console.warn("Weather check incomplete:", result.reason);
  }

  const wash = car.items.find((item) => item.kind === "wash");
  const nudge = evaluateNudge({
    weather: weather.status === "fulfilled" ? weather.value : undefined,
    air: air.status === "fulfilled" ? air.value : undefined,
    washStatus: wash && itemStatus(wash, now, estimateCarOdometer(car, now)),
    place: home.label,
  });
  return { nudge, complete: weather.status === "fulfilled" && air.status === "fulfilled" };
}
