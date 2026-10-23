import { BASELINE_INTERVALS, DAY_MS } from "../intervals";
import type { CarSnapshot, ScheduleItem, ScheduleItemKind, Vehicle } from "../types";

// The spec's demo car: a 2019 Honda Civic at about 48,000 mi, ~250 mi/week.
// Last wash 26 days ago -> overdue. Oil change ~400 mi away -> due soon. The rest are OK.
//
// Everything is dated relative to `now`, so the picture never goes stale.
// To show a real saved car instead, return a CarSnapshot from your own loader
// (see getCarSnapshot in src/lib/car.ts) and leave this file for the demo button.

type Service = {
  kind: ScheduleItemKind;
  daysAgo: number;
  // Odometer when it was last done. Only needed for items with a mileage interval.
  atOdometer?: number;
  // Overrides for the baseline table (e.g. from a manufacturer schedule).
  intervalMiles?: number;
  intervalSource?: ScheduleItem["intervalSource"];
};

const SERVICES: Service[] = [
  { kind: "wash", daysAgo: 26 },
  { kind: "tire_pressure", daysAgo: 10 },
  { kind: "oil", daysAgo: 300, atOdometer: 40_900 },
  { kind: "tire_rotation", daysAgo: 160, atOdometer: 43_500 },
  { kind: "wipers", daysAgo: 120 },
  {
    kind: "cabin_filter",
    daysAgo: 200,
    atOdometer: 38_000,
    intervalMiles: 12_000,
    intervalSource: {
      kind: "manufacturer",
      url: "https://owners.honda.com/vehicles/information/2019/Civic-Sedan/maintenance",
    },
  },
  // 91% of its mileage interval used, yet "OK": the status rule only looks 500 mi ahead.
  { kind: "engine_filter", daysAgo: 420, atOdometer: 29_800 },
  { kind: "brake_check", daysAgo: 120, atOdometer: 45_000 },
];

export function demoCar(now: Date): CarSnapshot {
  const vehicle: Vehicle = {
    id: "demo-civic",
    visitorId: "demo",
    year: 2019,
    make: "Honda",
    model: "Civic",
    epaMpg: 34,
    // Read one week ago, so the estimate today is this plus one week of driving: 48,000.
    odometer: 47_750,
    weeklyMiles: 250,
    home: { lat: 33.8442, lng: -117.9987, label: "Knott's Berry Farm, Buena Park, CA" },
  };

  const items = SERVICES.map((s): ScheduleItem => {
    const base = BASELINE_INTERVALS[s.kind];
    const intervalDays = base.days;
    const intervalMiles = s.intervalMiles ?? base.miles;
    const lastDoneAt = new Date(now.getTime() - s.daysAgo * DAY_MS);
    const dueAt =
      intervalDays === undefined ? undefined : new Date(lastDoneAt.getTime() + intervalDays * DAY_MS);
    const dueOdometer =
      intervalMiles === undefined || s.atOdometer === undefined ? undefined : s.atOdometer + intervalMiles;

    return {
      id: `demo-${s.kind}`,
      vehicleId: vehicle.id,
      kind: s.kind,
      intervalDays,
      intervalMiles,
      lastDoneAt: lastDoneAt.toISOString(),
      lastDoneOdometer: s.atOdometer,
      dueAt: dueAt?.toISOString(),
      dueOdometer,
      // Stale by design: the dashboard works status out from the due targets.
      status: "ok",
      intervalSource: s.intervalSource ?? { kind: "baseline" },
    };
  });

  return {
    vehicle,
    readingAt: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
    items,
  };
}
