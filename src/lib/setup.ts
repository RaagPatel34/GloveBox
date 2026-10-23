import type { EpaVehicle } from "./epa";
import { buildBaselineSchedule } from "./schedule";
import type { CarSnapshot, LatLng } from "./types";
import { isVisitorId } from "./visitor";

// Pure pieces of the car-setup flow: form validation, geocode parsing, snapshot building.
// The server action wires these to the network and the database.

export type SetupInput = {
  visitorId: string;
  epaVehicleId: string;
  odometer: number;
  weeklyMiles: number;
  mpgOverride: number | undefined;
  home: string;
};

export type SetupFields = keyof SetupInput;
export type SetupErrors = Partial<Record<SetupFields, string>>;

export const MAX_ODOMETER = 1_000_000;
export const MAX_WEEKLY_MILES = 2_000;

// "48,000" -> 48000. Anything that is not a plain non-negative number is NaN.
function toNumber(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string") return NaN;
  const cleaned = raw.replace(/[,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

export function parseSetupInput(
  data: FormData,
): { ok: true; value: SetupInput } | { ok: false; errors: SetupErrors } {
  const errors: SetupErrors = {};

  const visitorId = data.get("visitorId");
  if (!isVisitorId(visitorId)) errors.visitorId = "Missing visitor ID. Reload the page and try again.";

  const epaVehicleId = data.get("epaVehicleId");
  if (typeof epaVehicleId !== "string" || !/^\d+$/.test(epaVehicleId)) {
    errors.epaVehicleId = "Choose your car's year, make, model and engine.";
  }

  const odometer = toNumber(data.get("odometer"));
  if (!Number.isInteger(odometer) || odometer > MAX_ODOMETER) {
    errors.odometer = `Enter your odometer as a whole number of miles (up to ${MAX_ODOMETER.toLocaleString("en-US")}).`;
  }

  const weeklyMiles = toNumber(data.get("weeklyMiles"));
  if (!Number.isInteger(weeklyMiles) || weeklyMiles > MAX_WEEKLY_MILES) {
    errors.weeklyMiles = `Enter your weekly mileage as a whole number of miles (up to ${MAX_WEEKLY_MILES.toLocaleString("en-US")}).`;
  }

  const overrideRaw = data.get("mpgOverride");
  let mpgOverride: number | undefined;
  if (typeof overrideRaw === "string" && overrideRaw.trim() !== "") {
    mpgOverride = toNumber(overrideRaw);
    if (!(mpgOverride >= 1 && mpgOverride <= 200)) errors.mpgOverride = "MPG must be between 1 and 200, or left blank.";
  }

  const home = typeof data.get("home") === "string" ? (data.get("home") as string).trim() : "";
  if (home === "" || home.length > 200) errors.home = "Enter a city, ZIP or landmark for home.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      visitorId: visitorId as string,
      epaVehicleId: epaVehicleId as string,
      odometer,
      weeklyMiles,
      mpgOverride,
      home,
    },
  };
}

// Nominatim (OpenStreetMap) search result -> a point and a short label such as "Buena Park, California".
export function parseGeocodeResult(body: unknown): (LatLng & { label: string }) | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const hit: unknown = body[0];
  if (typeof hit !== "object" || hit === null) return null;
  const r = hit as Record<string, unknown>;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const display = typeof r.display_name === "string" ? r.display_name : "";
  const name = typeof r.name === "string" && r.name !== "" ? r.name : display.split(",")[0].trim();
  const address = typeof r.address === "object" && r.address !== null ? (r.address as Record<string, unknown>) : {};
  const state = typeof address.state === "string" ? address.state : "";
  const label = [name, state].filter((part) => part !== "").join(", ");
  return { lat, lng, label: label === "" ? "Home" : label };
}

export function buildSnapshot(args: {
  input: SetupInput;
  epa: EpaVehicle;
  home: LatLng & { label: string };
  now: Date;
  newId: () => string;
}): CarSnapshot {
  const { input, epa, home, now, newId } = args;
  const vehicleId = newId();
  return {
    vehicle: {
      id: vehicleId,
      visitorId: input.visitorId,
      year: epa.year,
      make: epa.make,
      model: epa.model,
      epaMpg: epa.combinedMpg,
      mpgOverride: input.mpgOverride,
      odometer: input.odometer,
      weeklyMiles: input.weeklyMiles,
      home,
    },
    readingAt: now.toISOString(),
    items: buildBaselineSchedule({ vehicleId, odometer: input.odometer, readingAt: now }, newId),
  };
}
