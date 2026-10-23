import type { CarSnapshot, ItemStatus, ScheduleItem, ScheduleItemKind } from "./types";

// Mapping between the app's CarSnapshot and the flat rows in Postgres (see src/lib/db/schema.ts).
// Pure, so it is tested without a database. Reading is lenient about what the driver
// returns (Date or ISO string for timestamps, number or string for numerics).

export type VehicleRow = {
  id: string;
  visitor_id: string;
  year: number;
  make: string;
  model: string;
  epa_mpg: number;
  mpg_override: number | null;
  odometer: number;
  weekly_miles: number;
  home_label: string;
  home_lat: number;
  home_lng: number;
  reading_at: string;
};

export type ItemRow = {
  id: string;
  vehicle_id: string;
  kind: string;
  interval_days: number | null;
  interval_miles: number | null;
  last_done_at: string | null;
  last_done_odometer: number | null;
  due_at: string | null;
  due_odometer: number | null;
  status: string;
  interval_source_kind: string;
  interval_source_url: string | null;
};

// What a driver may return for the same columns: timestamps as Date, numerics as strings.
type Loose<T, Times extends keyof T, Nums extends keyof T> = {
  [K in keyof T]: K extends Times ? T[K] | Date : K extends Nums ? T[K] | string : T[K];
};
type DriverVehicleRow = Loose<VehicleRow, "reading_at", "year" | "epa_mpg" | "mpg_override" | "odometer" | "weekly_miles" | "home_lat" | "home_lng">;
type DriverItemRow = Loose<
  ItemRow,
  "last_done_at" | "due_at",
  "interval_days" | "interval_miles" | "last_done_odometer" | "due_odometer"
>;

export function toRows(visitorId: string, snapshot: CarSnapshot): { vehicle: VehicleRow; items: ItemRow[] } {
  const { vehicle } = snapshot;
  return {
    vehicle: {
      id: vehicle.id,
      visitor_id: visitorId,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      epa_mpg: vehicle.epaMpg,
      mpg_override: vehicle.mpgOverride ?? null,
      odometer: vehicle.odometer,
      weekly_miles: vehicle.weeklyMiles,
      home_label: vehicle.home.label,
      home_lat: vehicle.home.lat,
      home_lng: vehicle.home.lng,
      reading_at: snapshot.readingAt,
    },
    items: snapshot.items.map((item) => ({
      id: item.id,
      vehicle_id: item.vehicleId,
      kind: item.kind,
      interval_days: item.intervalDays ?? null,
      interval_miles: item.intervalMiles ?? null,
      last_done_at: item.lastDoneAt ?? null,
      last_done_odometer: item.lastDoneOdometer ?? null,
      due_at: item.dueAt ?? null,
      due_odometer: item.dueOdometer ?? null,
      status: item.status,
      interval_source_kind: item.intervalSource.kind,
      interval_source_url: item.intervalSource.url ?? null,
    })),
  };
}

const toIsoString = (value: string | Date): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());
const toIsoStringOrUndefined = (value: string | Date | null): string | undefined => (value === null ? undefined : toIsoString(value));
const toNumber = (value: number | string): number => Number(value);
const toNumberOrUndefined = (value: number | string | null): number | undefined => (value === null ? undefined : Number(value));

export function fromRows(vehicle: DriverVehicleRow, items: DriverItemRow[]): CarSnapshot {
  return {
    vehicle: {
      id: vehicle.id,
      visitorId: vehicle.visitor_id,
      year: toNumber(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      epaMpg: toNumber(vehicle.epa_mpg),
      mpgOverride: toNumberOrUndefined(vehicle.mpg_override),
      odometer: toNumber(vehicle.odometer),
      weeklyMiles: toNumber(vehicle.weekly_miles),
      home: { label: vehicle.home_label, lat: toNumber(vehicle.home_lat), lng: toNumber(vehicle.home_lng) },
    },
    readingAt: toIsoString(vehicle.reading_at),
    items: items.map(
      (item): ScheduleItem => ({
        id: item.id,
        vehicleId: item.vehicle_id,
        kind: item.kind as ScheduleItemKind,
        intervalDays: toNumberOrUndefined(item.interval_days),
        intervalMiles: toNumberOrUndefined(item.interval_miles),
        lastDoneAt: toIsoStringOrUndefined(item.last_done_at),
        lastDoneOdometer: toNumberOrUndefined(item.last_done_odometer),
        dueAt: toIsoStringOrUndefined(item.due_at),
        dueOdometer: toNumberOrUndefined(item.due_odometer),
        status: item.status as ItemStatus,
        intervalSource: {
          kind: item.interval_source_kind === "manufacturer" ? "manufacturer" : "baseline",
          ...(item.interval_source_url === null ? {} : { url: item.interval_source_url }),
        },
      }),
    ),
  };
}
