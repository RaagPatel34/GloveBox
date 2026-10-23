// Shared contract between the frontend and the agent/data layer.
// Change these together, in one PR, so both halves stay in sync.

export type ModelTier = "nano" | "super" | "ultra";

export type LatLng = { lat: number; lng: number };

export type Vehicle = {
  id: string;
  visitorId: string;
  year: number;
  make: string;
  model: string;
  epaMpg: number;
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

export type ItemStatus = "overdue" | "due_soon" | "ok";

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
  intervalSource: { kind: "baseline" | "manufacturer"; url?: string };
};

export type Proposal = {
  id: string;
  vehicleId: string;
  itemId: string;
  from: DueTarget;
  to: DueTarget;
  reason: string;
  model: ModelTier;
  state: "pending" | "applied" | "dismissed";
  // When the user hid an applied card. It stays applied, but the dashboard no longer shows it.
  hiddenAt?: string;
};

export type GasPrice = {
  price: number;
  source: string;
  asOf: string;
  kind: "station" | "area" | "eia";
};

export type TripStop = LatLng & {
  label: string;
  type: "gas" | "wash" | "address";
};

export type DetourVerdict = {
  station: string;
  savings: number;
  detourCost: number;
  net: number;
  worthIt: boolean;
};

export type TripPlan = {
  stops: TripStop[];
  totalMiles: number;
  fuelCost: number;
  gasPrice: GasPrice;
  detour?: DetourVerdict;
  model: Exclude<ModelTier, "nano">;
};

export type Nudge = {
  id: string;
  vehicleId: string;
  text: string;
  reason: string;
  createdAt: string;
};

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
