// PROTOTYPE (issue #5): fixture car + view model shared by the dashboard variants.
// Throwaway: the real dashboard rebuilds this properly under /tdd.

import { BASELINE_INTERVALS, estimateOdometer, itemStatus } from "@/lib/intervals";
import type { ItemStatus, ScheduleItem, ScheduleItemKind, Vehicle } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardItem = {
  kind: ScheduleItemKind;
  label: string;
  status: ItemStatus;
  dueAt?: Date;
  dueOdometer?: number;
  daysLeft?: number;
  milesLeft?: number;
  // Best guess at the calendar day it comes due, converting miles via weekly miles.
  projectedDaysLeft: number;
  // 0..1+ share of the interval used up (whichever of time or miles is further along).
  used: number;
  lastDoneAt?: Date;
  source: ScheduleItem["intervalSource"];
};

export type Dashboard = {
  vehicle: Vehicle;
  readingAt: Date;
  odometerEstimate: number;
  items: DashboardItem[];
  counts: Record<ItemStatus, number>;
};

type Seed = {
  kind: ScheduleItemKind;
  lastDoneDaysAgo: number;
  lastDoneOdometer?: number;
  intervalDays?: number;
  intervalMiles?: number;
  source?: ScheduleItem["intervalSource"];
};

const SEEDS: Seed[] = [
  { kind: "wash", lastDoneDaysAgo: 17 },
  { kind: "tire_pressure", lastDoneDaysAgo: 25 },
  { kind: "oil", lastDoneDaysAgo: 300, lastDoneOdometer: 41_000 },
  { kind: "tire_rotation", lastDoneDaysAgo: 160, lastDoneOdometer: 43_500 },
  { kind: "wipers", lastDoneDaysAgo: 380 },
  {
    kind: "cabin_filter",
    lastDoneDaysAgo: 200,
    lastDoneOdometer: 38_000,
    intervalDays: 365,
    intervalMiles: 12_000,
    source: { kind: "manufacturer", url: "https://owners.honda.com/vehicles/information/2019/Civic-Sedan/maintenance" },
  },
  { kind: "engine_filter", lastDoneDaysAgo: 420, lastDoneOdometer: 30_000 },
  { kind: "brake_check", lastDoneDaysAgo: 120, lastDoneOdometer: 45_000 },
];

export function buildDashboard(now: Date): Dashboard {
  const readingAt = new Date(now.getTime() - 10 * DAY_MS);
  const vehicle: Vehicle = {
    id: "fixture-civic",
    visitorId: "prototype",
    year: 2019,
    make: "Honda",
    model: "Civic Sedan",
    epaMpg: 34,
    odometer: 48_020,
    weeklyMiles: 180,
    home: { lat: 33.867, lng: -117.998, label: "Buena Park, CA" },
  };
  const odometerEstimate = estimateOdometer(vehicle, readingAt, now);
  const milesPerDay = vehicle.weeklyMiles / 7;

  const items = SEEDS.map((seed): DashboardItem => {
    const base = BASELINE_INTERVALS[seed.kind];
    const intervalDays = seed.intervalDays ?? base.days;
    const intervalMiles = seed.intervalMiles ?? base.miles;
    const lastDoneAt = new Date(now.getTime() - seed.lastDoneDaysAgo * DAY_MS);

    const dueAt = intervalDays ? new Date(lastDoneAt.getTime() + intervalDays * DAY_MS) : undefined;
    const dueOdometer =
      intervalMiles && seed.lastDoneOdometer !== undefined ? seed.lastDoneOdometer + intervalMiles : undefined;

    const daysLeft = dueAt ? Math.round((dueAt.getTime() - now.getTime()) / DAY_MS) : undefined;
    const milesLeft = dueOdometer !== undefined ? dueOdometer - odometerEstimate : undefined;

    const projectedDaysLeft = Math.min(
      daysLeft ?? Infinity,
      milesLeft !== undefined ? Math.round(milesLeft / milesPerDay) : Infinity,
    );

    const usedDays = intervalDays ? seed.lastDoneDaysAgo / intervalDays : 0;
    const usedMiles =
      intervalMiles && seed.lastDoneOdometer !== undefined
        ? (odometerEstimate - seed.lastDoneOdometer) / intervalMiles
        : 0;

    return {
      kind: seed.kind,
      label: base.label,
      status: itemStatus(
        { dueAt: dueAt?.toISOString(), dueOdometer },
        now,
        odometerEstimate,
      ),
      dueAt,
      dueOdometer,
      daysLeft,
      milesLeft,
      projectedDaysLeft,
      used: Math.max(usedDays, usedMiles),
      lastDoneAt,
      source: seed.source ?? { kind: "baseline" },
    };
  });

  const counts = { overdue: 0, due_soon: 0, ok: 0 } satisfies Record<ItemStatus, number>;
  for (const item of items) counts[item.status]++;

  return { vehicle, readingAt, odometerEstimate, items, counts };
}

const STATUS_RANK: Record<ItemStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

export function byUrgency(a: DashboardItem, b: DashboardItem) {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.projectedDaysLeft - b.projectedDaysLeft;
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "OK",
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const numFmt = new Intl.NumberFormat("en-US");

export const fmtDate = (d: Date) => dateFmt.format(d);
export const fmtMiles = (n: number) => `${numFmt.format(Math.round(n))} mi`;

export function fmtDays(days: number) {
  const n = Math.abs(days);
  if (days === 0) return "today";
  const unit = n === 1 ? "day" : "days";
  return days < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}

// One human sentence for "when", combining whichever targets the item has.
export function dueSummary(item: DashboardItem) {
  const parts: string[] = [];
  if (item.dueAt && item.daysLeft !== undefined) parts.push(`${fmtDate(item.dueAt)} (${fmtDays(item.daysLeft)})`);
  if (item.dueOdometer !== undefined && item.milesLeft !== undefined) {
    parts.push(
      item.milesLeft < 0
        ? `${fmtMiles(item.dueOdometer)} (${fmtMiles(-item.milesLeft)} over)`
        : `${fmtMiles(item.dueOdometer)} (${fmtMiles(item.milesLeft)} left)`,
    );
  }
  return parts.join(" or ");
}
