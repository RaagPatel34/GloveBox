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
  const v = snapshot.vehicle;
  return {
    vehicle: {
      id: v.id,
      visitor_id: visitorId,
      year: v.year,
      make: v.make,
      model: v.model,
      epa_mpg: v.epaMpg,
      mpg_override: v.mpgOverride ?? null,
      odometer: v.odometer,
      weekly_miles: v.weeklyMiles,
      home_label: v.home.label,
      home_lat: v.home.lat,
      home_lng: v.home.lng,
      reading_at: snapshot.readingAt,
    },
    items: snapshot.items.map((i) => ({
      id: i.id,
      vehicle_id: i.vehicleId,
      kind: i.kind,
      interval_days: i.intervalDays ?? null,
      interval_miles: i.intervalMiles ?? null,
      last_done_at: i.lastDoneAt ?? null,
      last_done_odometer: i.lastDoneOdometer ?? null,
      due_at: i.dueAt ?? null,
      due_odometer: i.dueOdometer ?? null,
      status: i.status,
      interval_source_kind: i.intervalSource.kind,
      interval_source_url: i.intervalSource.url ?? null,
    })),
  };
}

const iso = (value: string | Date): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());
const isoOrUndefined = (value: string | Date | null): string | undefined => (value === null ? undefined : iso(value));
const num = (value: number | string): number => Number(value);
const numOrUndefined = (value: number | string | null): number | undefined => (value === null ? undefined : Number(value));

export function fromRows(vehicle: DriverVehicleRow, items: DriverItemRow[]): CarSnapshot {
  return {
    vehicle: {
      id: vehicle.id,
      visitorId: vehicle.visitor_id,
      year: num(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      epaMpg: num(vehicle.epa_mpg),
      mpgOverride: numOrUndefined(vehicle.mpg_override),
      odometer: num(vehicle.odometer),
      weeklyMiles: num(vehicle.weekly_miles),
      home: { label: vehicle.home_label, lat: num(vehicle.home_lat), lng: num(vehicle.home_lng) },
    },
    readingAt: iso(vehicle.reading_at),
    items: items.map(
      (i): ScheduleItem => ({
        id: i.id,
        vehicleId: i.vehicle_id,
        kind: i.kind as ScheduleItemKind,
        intervalDays: numOrUndefined(i.interval_days),
        intervalMiles: numOrUndefined(i.interval_miles),
        lastDoneAt: isoOrUndefined(i.last_done_at),
        lastDoneOdometer: numOrUndefined(i.last_done_odometer),
        dueAt: isoOrUndefined(i.due_at),
        dueOdometer: numOrUndefined(i.due_odometer),
        status: i.status as ItemStatus,
        intervalSource: {
          kind: i.interval_source_kind === "manufacturer" ? "manufacturer" : "baseline",
          ...(i.interval_source_url === null ? {} : { url: i.interval_source_url }),
        },
      }),
    ),
  };
}
