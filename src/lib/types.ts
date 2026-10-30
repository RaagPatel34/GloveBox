// Shared contract between the frontend and the agent/data layer.
// Change these together, in one PR, so both halves stay in sync.

import type { Place } from "./maps";

export type ModelTier = "nano" | "super" | "ultra";

export type LatLng = { lat: number; lng: number };

export type Vehicle = {
  id: string;
  visitorId: string;
  year: number;
  make: string;
  model: string;
  epaMpg: number;
  mpgSource?: { kind: "manual" | "epa" | "sample"; url?: string };
  isDemo?: boolean;
  mpgOverride?: number;
  odometer: number;
  weeklyMiles: number;
  home: LatLng & { label: string };
};

export type ScheduleItemKind =
  | "wash"
  | "oil"
  | "tire_rotation"
  | "tire_pressure"
  | "wipers"
  | "cabin_filter"
  | "engine_filter"
  | "brake_check";

export type ItemStatus = "overdue" | "due_soon" | "ok" | "unknown";

export type DueTarget = { dueAt?: string; dueOdometer?: number };

export type ScheduleItem = DueTarget & {
  id: string;
  vehicleId: string;
  kind: ScheduleItemKind;
  intervalDays?: number;
  intervalMiles?: number;
  lastDoneAt?: string;
  lastDoneOdometer?: number;
  status: ItemStatus;
  intervalSource: { kind: "baseline" | "manufacturer" | "user" | "nhtsa"; url?: string; note?: string };
  reminderOrigin?: "sample" | "ai" | "service" | "user";
};

export type Proposal = {
  id: string;
  vehicleId: string;
  itemId: string;
  from: DueTarget;
  to: DueTarget;
  reason: string;
  model: ModelTier | "sample";
  sourceUrl?: string;
  state: "pending" | "applied" | "dismissed";
  // When the user hid an applied card. It stays applied, but the dashboard no longer shows it.
  hiddenAt?: string;
};

export type GasPrice = {
  price: number;
  source: string;
  asOf: string;
  kind: "station" | "area" | "eia";
  // What the price averages, like "Los Angeles weekly regular gasoline average".
  label?: string;
  // More than two weeks old.
  stale?: boolean;
};

// What to price: one station, or an area such as "Buena Park, CA". Neither means the EIA average.
export type GasPriceQuery = { station?: Place; area?: string };

export type TripStop = LatLng & {
  // The address the route drives to.
  label: string;
  // The place's own name, like "Trader Joe's", when it has one.
  name?: string;
  type: "gas" | "wash" | "address";
};

// A stop as the user asked for it: "gas" and "car wash" are kinds of place to find, anything
// else is a named place.
export type ErrandStop = { type: "gas" | "wash" } | { type: "address"; name: string };

// The one check for a stop from the router or the Trips panel: a gas or car-wash stop, or a
// named place whose trimmed name is 1–200 characters. Null for anything else.
export function toErrandStop(value: unknown): ErrandStop | null {
  const { type, name } = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  if (type === "gas" || type === "wash") return { type };
  const trimmed = typeof name === "string" ? name.trim() : "";
  return type === "address" && trimmed !== "" && trimmed.length <= 200 ? { type, name: trimmed } : null;
}

export type DetourVerdict = {
  station: string;
  savings: number;
  detourCost: number;
  net: number;
  worthIt: boolean;
};

// The trip agent's verdict on a cheaper gas station (#15), with every price it weighed.
// `station` names the cheaper one.
export type TripDetour = DetourVerdict & {
  // The cheaper station's price.
  price: GasPrice;
  // The station on the way, which the route uses unless the detour is worth it, and its price.
  usual: { station: string; price: GasPrice };
  // Extra round-trip miles to buy gas at the cheaper station instead.
  extraMiles: number;
  // The fill-up the savings are counted on.
  gallons: number;
};

// A drive from home through the stops and back. Home is not in `stops`; they are in driving order.
export type TripPlan = {
  stops: TripStop[];
  totalMiles: number;
  totalMinutes: number;
  fuelCost: number;
  gasPrice: GasPrice;
  // The gas stations Places listed near where the gas stop was searched, in Google's order; the
  // first is the one the plan routes through. What a detour verdict chooses between.
  gasCandidates?: TripStop[];
  // Set only on Ultra, when there was a cheaper station to weigh. When it is worth it, the
  // stops, miles and fuel cost already go through the cheaper station.
  detour?: TripDetour;
  model: Exclude<ModelTier, "nano">;
  // The same drive in Google Maps.
  mapsUrl: string;
};

// What POST /api/plan-trip answers with: a plan, or a message saying why there is none.
export type TripReply = {
  // Which model produced this reply, for its badge. Null when no model answered.
  model: ModelTier | null;
  message: string;
  plan: TripPlan | null;
};

export type Nudge = {
  id: string;
  vehicleId: string;
  text: string;
  reason: string;
  createdAt: string;
};

export type ServiceEntry = { id: string; itemId: string; date: string; odometer: number; notes: string; createdAt: string };

// What POST /api/command answers with.
export type CommandReply = {
  // Which model produced this reply, for its badge. Null when no model answered
  // (empty input, the AI not set up or not reachable).
  model: ModelTier | null;
  message: string;
  // One line per change made, written by code from tool results, never by the model.
  // Non-empty means the car changed and the dashboard should reload.
  changes: string[];
  // How many proposal cards this reply added. Above zero, the dashboard should reload to show them.
  proposals: number;
  // The drive an errand became, when there is one. It changes nothing about the car.
  trip?: TripPlan;
};

// Everything the dashboard needs to know about one car. This is the seam for loading:
// the fixture builds one today, and the saved-car flow builds one from storage later.
export type CarSnapshot = {
  vehicle: Vehicle;
  // ISO timestamp of when `vehicle.odometer` was read.
  readingAt: string;
  // Miles from trips the user has planned but not yet driven.
  plannedTripMiles?: number;
  items: ScheduleItem[];
};
