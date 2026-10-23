import { describe, expect, it } from "vitest";
import { getAirQuality, getWeather, parseAirQuality, parseForecast } from "./weather";

// Response bodies below are trimmed from the live Open-Meteo APIs (no key), fetched for
// Knott's Berry Farm on 2026-10-23.

const FORECAST = {
  latitude: 33.854134,
  longitude: -118.01141,
  timezone: "America/Los_Angeles",
  daily_units: { time: "iso8601", precipitation_probability_max: "%", precipitation_sum: "inch" },
  daily: {
    time: ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"],
    precipitation_probability_max: [22, 1, 0, 0, 0, 0, 1],
    precipitation_sum: [0.0, 0.0, 0.0, 0.0, 0.0, 0.012, 0.0],
  },
};

const AIR = {
  latitude: 33.800003,
  longitude: -118.0,
  timezone: "America/Los_Angeles",
  current: { time: "2026-10-23T02:00", interval: 3600, pm2_5: 8.8, us_aqi: 40 },
  hourly: {
    time: ["2026-10-23T00:00", "2026-10-23T01:00", "2026-10-23T02:00", "2026-10-23T03:00", "2026-10-23T04:00"],
    pm2_5: [11.9, 10.4, 8.8, 7.9, 7.3],
  },
};

describe("parseForecast", () => {
  it("reads one entry per day, in the car's local dates", () => {
    const forecast = parseForecast(FORECAST);
    expect(forecast?.days).toHaveLength(7);
    expect(forecast?.days[0]).toEqual({ date: "2026-10-23", rainChance: 22, rainInches: 0 });
    expect(forecast?.days[5]).toEqual({ date: "2026-10-28", rainChance: 0, rainInches: 0.012 });
  });

  it("keeps a missing chance of rain as null rather than 0", () => {
    const body = { daily: { ...FORECAST.daily, precipitation_probability_max: [null, 0, 0, 0, 0, 0, 0] } };
    expect(parseForecast(body)?.days[0].rainChance).toBeNull();
  });

  it("rejects a body that is not a forecast", () => {
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({ error: true, reason: "Latitude must be in range" })).toBeNull();
    expect(parseForecast({ daily: { time: ["2026-10-23"], precipitation_sum: [] } })).toBeNull();
  });

  it("rejects a forecast whose first day's rainfall is missing: nothing usable is left", () => {
    const body = { daily: { ...FORECAST.daily, precipitation_sum: [null, 0, 0, 0, 0, 0, 0] } };
    expect(parseForecast(body)).toBeNull();
  });

  it("keeps the days before one whose rainfall is missing, so a real rain-hold is not lost", () => {
    const body = { daily: { ...FORECAST.daily, precipitation_sum: [0, 0.4, null, 0, 0, 0, 0] } };
    const forecast = parseForecast(body);
    expect(forecast?.days.map((d) => d.date)).toEqual(["2026-10-23", "2026-10-24"]);
    expect(forecast?.days[1].rainInches).toBe(0.4);
  });
});

describe("parseAirQuality", () => {
  it("reads the current PM2.5 and AQI", () => {
    expect(parseAirQuality(AIR)).toMatchObject({ pm25Now: 8.8, usAqi: 40, asOf: "2026-10-23T02:00" });
  });

  it("takes the peak PM2.5 from now onward, not from hours already past", () => {
    // 11.9 at 00:00 is before the 02:00 reading.
    expect(parseAirQuality(AIR)?.pm25Peak24h).toBe(8.8);
    const rising = { ...AIR, hourly: { ...AIR.hourly, pm2_5: [11.9, 10.4, 8.8, 40.5, 7.3] } };
    expect(parseAirQuality(rising)?.pm25Peak24h).toBe(40.5);
  });

  it("counts the hour in progress: a 14:15 reading still has the 14:00 slot ahead of it", () => {
    const body = {
      current: { time: "2026-10-23T14:15", pm2_5: 8, us_aqi: 30 },
      hourly: { time: ["2026-10-23T13:00", "2026-10-23T14:00", "2026-10-23T15:00"], pm2_5: [99, 50, 9] },
    };
    expect(parseAirQuality(body)?.pm25Peak24h).toBe(50);
  });

  it("looks only 24 hours ahead", () => {
    const times = Array.from({ length: 48 }, (_, h) => `2026-10-${h < 24 ? "23" : "24"}T${String(h % 24).padStart(2, "0")}:00`);
    const pm = times.map((_, h) => (h === 30 ? 90 : 5));
    const body = { current: { time: "2026-10-23T00:00", pm2_5: 5, us_aqi: 21 }, hourly: { time: times, pm2_5: pm } };
    expect(parseAirQuality(body)?.pm25Peak24h).toBe(5);
  });

  it("falls back to the current reading when no hourly values are usable", () => {
    const body = { current: AIR.current, hourly: { time: AIR.hourly.time, pm2_5: [null, null, null, null, null] } };
    expect(parseAirQuality(body)).toMatchObject({ pm25Now: 8.8, pm25Peak24h: 8.8 });
  });

  it("reports an unknown AQI as null", () => {
    const body = { ...AIR, current: { time: "2026-10-23T02:00", pm2_5: 8.8 } };
    expect(parseAirQuality(body)?.usAqi).toBeNull();
  });

  it("rejects a body without a current PM2.5", () => {
    expect(parseAirQuality(null)).toBeNull();
    expect(parseAirQuality({ current: { time: "2026-10-23T02:00", pm2_5: null } })).toBeNull();
  });
});

describe("getWeather / getAirQuality", () => {
  const home = { lat: 33.8442, lng: -117.9987 };

  function fakeFetch(body: unknown, status = 200) {
    const calls: string[] = [];
    const fn = async (url: string) => {
      calls.push(url);
      return Response.json(body, { status });
    };
    return { fn, calls };
  }

  it("asks Open-Meteo's forecast for the car's home, in US units and local time", async () => {
    const { fn, calls } = fakeFetch(FORECAST);
    const forecast = await getWeather(home, fn);
    expect(forecast.days).toHaveLength(7);
    const url = new URL(calls[0]);
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("33.8442");
    expect(url.searchParams.get("longitude")).toBe("-117.9987");
    expect(url.searchParams.get("precipitation_unit")).toBe("inch");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  it("asks Open-Meteo's air-quality API for the car's home", async () => {
    const { fn, calls } = fakeFetch(AIR);
    expect((await getAirQuality(home, fn)).pm25Now).toBe(8.8);
    const url = new URL(calls[0]);
    expect(url.origin + url.pathname).toBe("https://air-quality-api.open-meteo.com/v1/air-quality");
    expect(url.searchParams.get("latitude")).toBe("33.8442");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  it("throws when the service is down, so callers decide how to degrade", async () => {
    await expect(getWeather(home, fakeFetch({}, 503).fn)).rejects.toThrow("Open-Meteo responded 503");
    await expect(getAirQuality(home, fakeFetch({}, 429).fn)).rejects.toThrow("Open-Meteo responded 429");
  });

  it("throws on a body it cannot read", async () => {
    await expect(getWeather(home, fakeFetch({ error: true }).fn)).rejects.toThrow("unexpected forecast");
    await expect(getAirQuality(home, fakeFetch({ error: true }).fn)).rejects.toThrow("unexpected air-quality");
  });
});
