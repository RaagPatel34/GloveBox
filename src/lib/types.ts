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
  intervalSource: { kind: "baseline" | "manufacturer"; url?: string };
};

export type Proposal = {
  id: string;
  vehicleId: string;
  itemId: string;
  from: DueTarget;
  to: DueTarget;
  reason: string;
  model: ModelTier | "sample";
  state: "pending" | "applied" | "dismissed";
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
