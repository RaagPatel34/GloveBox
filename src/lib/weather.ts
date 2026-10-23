import type { LatLng } from "./types";

// Open-Meteo forecast and air quality (both free, no key). Docs: https://open-meteo.com/en/docs
// The `getWeather` / `getAirQuality` tools from docs/SPEC.md.
//
// Asked for in US units and `timezone=auto`, so dates and hours are the car's own local ones.
// Parsing is pure and tested; the clients take `fetch` as an argument so tests need no network.
// A failed or unreadable response throws: callers decide how to degrade (see nudge-check.ts).

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export type ForecastDay = {
  // Local calendar date, YYYY-MM-DD.
  date: string;
  // Highest hourly chance of precipitation, percent. Null when the model gives none.
  rainChance: number | null;
  // Total precipitation for the day, inches.
  rainInches: number;
};

export type WeatherForecast = { days: ForecastDay[] };

export type AirQuality = {
  // Local time of the current reading, YYYY-MM-DDTHH:mm.
  asOf: string;
  // PM2.5 in µg/m³, the fine particles in wildfire smoke and ash.
  pm25Now: number;
  // The highest PM2.5 from now through the next 24 hours.
  pm25Peak24h: number;
  // US AQI, null when not reported.
  usAqi: number | null;
};

const HOURS_AHEAD = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseForecast(body: unknown): WeatherForecast | null {
  if (!isRecord(body) || !isRecord(body.daily)) return null;
  const { time, precipitation_sum: sums, precipitation_probability_max: chances } = body.daily;
  if (!Array.isArray(time) || !Array.isArray(sums) || time.length === 0 || sums.length !== time.length) return null;

  const days: ForecastDay[] = [];
  for (let i = 0; i < time.length; i++) {
    if (typeof time[i] !== "string" || !isNumber(sums[i])) return null;
    const chance = Array.isArray(chances) ? chances[i] : null;
    days.push({ date: time[i], rainChance: isNumber(chance) ? chance : null, rainInches: sums[i] });
  }
  return { days };
}

export function parseAirQuality(body: unknown): AirQuality | null {
  if (!isRecord(body) || !isRecord(body.current)) return null;
  const { time: asOf, pm2_5: pm25Now, us_aqi: usAqi } = body.current;
  if (typeof asOf !== "string" || !isNumber(pm25Now)) return null;

  // Hourly times are local ISO strings, so they compare as text. Hours already past are skipped.
  let peak = pm25Now;
  if (isRecord(body.hourly) && Array.isArray(body.hourly.time) && Array.isArray(body.hourly.pm2_5)) {
    const { time, pm2_5: values } = body.hourly;
    let seen = 0;
    for (let i = 0; i < time.length && seen < HOURS_AHEAD; i++) {
      if (typeof time[i] !== "string" || time[i] < asOf) continue;
      seen++;
      if (isNumber(values[i])) peak = Math.max(peak, values[i]);
    }
  }
  return { asOf, pm25Now, pm25Peak24h: peak, usAqi: isNumber(usAqi) ? usAqi : null };
}

type FetchLike = (url: string) => Promise<Response>;

// A slow weather service must not hold up a page or the demo-car click.
const TIMEOUT_MS = 6_000;
const defaultFetch: FetchLike = (url) =>
  fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });

async function getJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return res.json();
}

export async function getWeather(location: LatLng, fetchImpl: FetchLike = defaultFetch): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lng),
    daily: "precipitation_probability_max,precipitation_sum",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "7",
  });
  const forecast = parseForecast(await getJson(`${FORECAST_URL}?${params}`, fetchImpl));
  if (forecast === null) throw new Error("Open-Meteo sent an unexpected forecast");
  return forecast;
}

export async function getAirQuality(location: LatLng, fetchImpl: FetchLike = defaultFetch): Promise<AirQuality> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lng),
    current: "pm2_5,us_aqi",
    hourly: "pm2_5",
    timezone: "auto",
    forecast_days: "2",
  });
  const air = parseAirQuality(await getJson(`${AIR_QUALITY_URL}?${params}`, fetchImpl));
  if (air === null) throw new Error("Open-Meteo sent an unexpected air-quality reading");
  return air;
}
