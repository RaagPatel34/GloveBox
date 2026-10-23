import { BASELINE_INTERVALS, estimateCarOdometer, itemStatus, STATUS_RANK } from "./intervals";
import { tighterLimit, type Limit } from "./limits";
import { sameDueDay } from "./days";
import { formatReadDate, intervalUsed, numberFormat } from "./readout";
import type { CarSnapshot, ItemStatus, ModelTier, Proposal, ScheduleItem, ScheduleItemKind, Vehicle } from "./types";

export type DashboardItem = {
  id: string;
  kind: ScheduleItemKind;
  label: string;
  status: ItemStatus;
  limit: Limit | null;
  // Whole-number share of the interval used. Can exceed 100 when overdue. Null if unknown.
  usedPercent: number | null;
  source: ScheduleItem["intervalSource"];
};

// A proposal card: which item, what moves (a due date, a due mileage, or both), and why.
export type ProposalCard = {
  id: string;
  label: string;
  moves: { from: string; to: string }[];
  reason: string;
  model: ModelTier;
  state: "pending" | "applied";
};

export type Dashboard = {
  vehicle: Vehicle;
  readingAt: Date;
  odometerEstimate: number;
  items: DashboardItem[];
  counts: Record<ItemStatus, number>;
  proposals: ProposalCard[];
};


function compareAscending(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

// Dismissed cards are gone, and so are hidden ones and cards for an item the car no longer has.
function proposalCards(car: CarSnapshot, proposals: Proposal[]): ProposalCard[] {
  const day = (iso: string | undefined) => (iso === undefined ? "—" : formatReadDate(new Date(iso)));
  const miles = (n: number | undefined) => (n === undefined ? "—" : `${numberFormat.format(n)} mi`);
  return proposals.flatMap((proposal): ProposalCard[] => {
    const item = car.items.find((i) => i.id === proposal.itemId);
    if (!item || proposal.state === "dismissed" || proposal.hiddenAt !== undefined) return [];
    const { from, to } = proposal;
    const moves = [
      ...(!sameDueDay(from.dueAt, to.dueAt) ? [{ from: day(from.dueAt), to: day(to.dueAt) }] : []),
      ...(from.dueOdometer !== to.dueOdometer ? [{ from: miles(from.dueOdometer), to: miles(to.dueOdometer) }] : []),
    ];
    return [
      {
        id: proposal.id,
        label: BASELINE_INTERVALS[item.kind].label,
        moves,
        reason: proposal.reason,
        model: proposal.model,
        state: proposal.state,
      },
    ];
  });
}

export function buildDashboard(car: CarSnapshot, now: Date, proposals: Proposal[] = []): Dashboard {
  const { vehicle } = car;
  const readingAt = new Date(car.readingAt);
  const odometerEstimate = estimateCarOdometer(car, now);

  const items = car.items.map((item): DashboardItem => {
    const used = intervalUsed(item, now, odometerEstimate);
    return {
      id: item.id,
      kind: item.kind,
      label: BASELINE_INTERVALS[item.kind].label,
      // Recomputed from the due targets: the stored status goes stale as time passes.
      status: itemStatus(item, now, odometerEstimate),
      limit: tighterLimit(item, now, odometerEstimate, vehicle.weeklyMiles),
      usedPercent: used === null ? null : Math.round(used * 100),
      source: item.intervalSource,
    };
  });

  items.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      // Items with no limit go last. Compared explicitly: Infinity - Infinity is NaN.
      compareAscending(a.limit?.inDays ?? Infinity, b.limit?.inDays ?? Infinity),
  );

  const counts: Record<ItemStatus, number> = { overdue: 0, due_soon: 0, ok: 0 };
  for (const item of items) counts[item.status]++;

  return { vehicle, readingAt, odometerEstimate, items, counts, proposals: proposalCards(car, proposals) };
}

// One tile per digit, zero-padded to at least six places like a real odometer.
// A value that is not a finite number reads as zero rather than "NaN".
export function odometerDigits(miles: number): string[] {
  const whole = Number.isFinite(miles) ? Math.max(0, Math.round(miles)) : 0;
  return String(whole).padStart(6, "0").split("");
}
