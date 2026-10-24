// fueleconomy.gov vehicle picker: year -> make -> model -> option -> combined MPG.
// Public REST API, no key. Docs: https://www.fueleconomy.gov/feg/ws/
//
// Quirks of the JSON form (verified against the live API):
//   - a menu with no matches comes back as the literal body `null`
//   - a menu with exactly one entry has `menuItem` as an object, not an array
//   - every number in the vehicle record is a string
// Parsing is pure and tested; the client takes `fetch` as an argument so tests need no network.
import type { FetchLike } from "./weather";

const BASE = "https://www.fueleconomy.gov/ws/rest/vehicle";

// Shared by the proxy route and the setup form so both say the same thing when the service is down.
export const EPA_UNREACHABLE = "Could not reach fueleconomy.gov.";

export type MenuItem = { text: string; value: string };

export type EpaVehicle = {
  epaVehicleId: string;
  year: number;
  make: string;
  model: string;
  // EPA combined fuel economy (comb08). MPGe for electric vehicles.
  combinedMpg: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseMenu(body: unknown): MenuItem[] {
  if (!isRecord(body)) return [];
  const raw = body.menuItem;
  const entries = Array.isArray(raw) ? raw : [raw];
  const items: MenuItem[] = [];
  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.text === "string" && typeof entry.value === "string") {
      items.push({ text: entry.text, value: entry.value });
    }
  }
  return items;
}

export function parseVehicleDetail(body: unknown): EpaVehicle | null {
  if (!isRecord(body)) return null;
  const combinedMpg = Number(body.comb08);
  const year = Number(body.year);
  if (!(combinedMpg > 0) || !Number.isFinite(year)) return null;
  if (typeof body.id !== "string" || typeof body.make !== "string" || typeof body.model !== "string") {
    return null;
  }
  return {
    epaVehicleId: body.id,
    year,
    make: body.make,
    model: body.model,
    combinedMpg,
  };
}

export type EpaClient = {
  years(): Promise<MenuItem[]>;
  makes(year: number): Promise<MenuItem[]>;
  models(year: number, make: string): Promise<MenuItem[]>;
  options(year: number, make: string, model: string): Promise<MenuItem[]>;
  vehicle(epaVehicleId: string): Promise<EpaVehicle | null>;
};

export function createEpaClient(fetchImpl: FetchLike = (url) => fetch(url, { headers: { Accept: "application/json" } })): EpaClient {
  async function getJson(path: string): Promise<{ status: number; body: unknown }> {
    const res = await fetchImpl(`${BASE}/${path}`);
    if (res.status === 404) return { status: 404, body: null };
    if (!res.ok) throw new Error(`fueleconomy.gov responded ${res.status} for ${path}`);
    const text = await res.text();
    return { status: res.status, body: text.trim() === "" ? null : JSON.parse(text) };
  }

  const query = (params: Record<string, string | number>) =>
    new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

  return {
    async years() {
      return parseMenu((await getJson("menu/year")).body);
    },
    async makes(year) {
      return parseMenu((await getJson(`menu/make?${query({ year })}`)).body);
    },
    async models(year, make) {
      return parseMenu((await getJson(`menu/model?${query({ year, make })}`)).body);
    },
    async options(year, make, model) {
      return parseMenu((await getJson(`menu/options?${query({ year, make, model })}`)).body);
    },
    async vehicle(epaVehicleId) {
      if (!/^\d+$/.test(epaVehicleId)) return null;
      return parseVehicleDetail((await getJson(`${epaVehicleId}`)).body);
    },
  };
}
