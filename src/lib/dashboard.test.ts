import { describe, expect, it } from "vitest";
import { buildDashboard, odometerDigits } from "./dashboard";
import { inDays, NOW } from "./test-support";
import type { CarSnapshot, Proposal, ScheduleItem, Vehicle } from "./types";

const vehicle: Vehicle = {
  id: "v1",
  visitorId: "anon",
  year: 2019,
  make: "Honda",
  model: "Civic",
  epaMpg: 34,
  odometer: 47_750,
  weeklyMiles: 250,
  home: { lat: 33.8, lng: -118, label: "Buena Park, CA" },
};

function item(over: Partial<ScheduleItem> & Pick<ScheduleItem, "kind">): ScheduleItem {
  return {
    id: over.kind,
    vehicleId: "v1",
    status: "ok",
    intervalSource: { kind: "baseline" },
    ...over,
  };
}

function snapshot(items: ScheduleItem[], over: Partial<CarSnapshot> = {}): CarSnapshot {
  return { vehicle, readingAt: inDays(-7), items, ...over };
}

describe("buildDashboard", () => {
  it("estimates the odometer from the last reading, weekly miles and planned trip miles", () => {
    expect(buildDashboard(snapshot([]), NOW).odometerEstimate).toBe(48_000);
    expect(buildDashboard(snapshot([], { plannedTripMiles: 120 }), NOW).odometerEstimate).toBe(48_120);
  });

  it("works out status from the due targets, ignoring a stale stored status", () => {
    const dash = buildDashboard(
      snapshot([item({ kind: "wipers", dueAt: inDays(-3), status: "ok" })]),
      NOW,
    );
    expect(dash.items[0].status).toBe("overdue");
  });

  it("compares due mileage against the estimated odometer, not the last reading", () => {
    // Last reading 47,750 is 750 short of 48,500, but the estimate (48,000) is 500 short.
    const dash = buildDashboard(snapshot([item({ kind: "oil", dueOdometer: 48_500 })]), NOW);
    expect(dash.items[0].status).toBe("due_soon");
  });

  it("sorts most urgent first, then soonest within a status", () => {
    const dash = buildDashboard(
      snapshot([
        item({ kind: "brake_check", dueOdometer: 57_000 }),
        item({ kind: "oil", dueOdometer: 48_400 }),
        item({ kind: "wash", dueAt: inDays(-12) }),
        item({ kind: "tire_pressure", dueAt: inDays(3) }),
        item({ kind: "wipers", dueAt: inDays(90) }),
        item({ kind: "cabin_filter" }),
      ]),
      NOW,
    );
    expect(dash.items.map((i) => i.kind)).toEqual([
      "wash",
      "tire_pressure", // 3 days
      "oil", // 400 mi ~ 11 days
      "wipers", // ok, 90 days
      "brake_check", // ok, 9,000 mi ~ 252 days
      "cabin_filter", // ok, no due target
    ]);
  });

  it("counts items by status", () => {
    const dash = buildDashboard(
      snapshot([
        item({ kind: "wash", dueAt: inDays(-12) }),
        item({ kind: "oil", dueOdometer: 48_400 }),
        item({ kind: "wipers", dueAt: inDays(90) }),
        item({ kind: "brake_check", dueOdometer: 57_000 }),
      ]),
      NOW,
    );
    expect(dash.counts).toEqual({ overdue: 1, due_soon: 1, ok: 2 });
  });

  it("gives each item its tighter limit, label, used share and interval source", () => {
    const dash = buildDashboard(
      snapshot([
        item({
          kind: "cabin_filter",
          dueAt: inDays(165),
          dueOdometer: 50_000,
          intervalDays: 365,
          intervalMiles: 12_000,
          intervalSource: { kind: "manufacturer", url: "https://example.com/manual" },
        }),
      ]),
      NOW,
    );
    const [card] = dash.items;
    expect(card.label).toBe("Cabin air filter");
    expect(card.limit).toMatchObject({ kind: "miles", remaining: 2_000 });
    expect(card.usedPercent).toBe(83); // miles: 10,000 / 12,000
    expect(card.source).toEqual({ kind: "manufacturer", url: "https://example.com/manual" });
  });

  it("keeps items with no due target in their original order, after those with one", () => {
    const dash = buildDashboard(
      snapshot([
        item({ kind: "cabin_filter" }),
        item({ kind: "engine_filter" }),
        item({ kind: "wipers", dueAt: inDays(90) }),
      ]),
      NOW,
    );
    expect(dash.items.map((i) => i.kind)).toEqual(["wipers", "cabin_filter", "engine_filter"]);
  });

  it("gives an item with an unreadable due date no limit and no used share, never NaN", () => {
    const dash = buildDashboard(
      snapshot([item({ kind: "wipers", dueAt: "not a date", intervalDays: 365 })]),
      NOW,
    );
    expect(dash.items[0].limit).toBeNull();
    expect(dash.items[0].usedPercent).toBeNull();
  });

  it("leaves used share empty when the interval is unknown", () => {
    const dash = buildDashboard(snapshot([item({ kind: "wipers", dueAt: inDays(10) })]), NOW);
    expect(dash.items[0].usedPercent).toBeNull();
  });
});

describe("buildDashboard: proposal cards", () => {
  const oil = item({ kind: "oil", dueAt: "2026-12-26T12:00:00.000Z", dueOdometer: 48_400 });
  const proposal = (over: Partial<Proposal>): Proposal => ({
    id: "p1",
    vehicleId: "v1",
    itemId: "oil",
    from: { dueAt: oil.dueAt, dueOdometer: 48_400 },
    to: { dueAt: oil.dueAt, dueOdometer: 48_000 },
    reason: "Change the oil before 300 dusty miles.",
    model: "super",
    state: "pending",
    ...over,
  });

  it("shows each card's item, what moves from and to, its reason, model and state", () => {
    const dash = buildDashboard(snapshot([oil]), NOW, [proposal({})]);
    expect(dash.proposals).toEqual([
      {
        id: "p1",
        label: "Oil change (synthetic)",
        moves: [{ from: "48,400 mi", to: "48,000 mi" }],
        reason: "Change the oil before 300 dusty miles.",
        model: "super",
        state: "pending",
      },
    ]);
  });

  it("shows a due date as a day, and both moves when date and mileage change", () => {
    const both = proposal({ to: { dueAt: "2026-10-25T12:00:00.000Z", dueOdometer: 48_000 } });
    expect(buildDashboard(snapshot([oil]), NOW, [both]).proposals[0].moves).toEqual([
      { from: "Dec 26", to: "Oct 25" },
      { from: "48,400 mi", to: "48,000 mi" },
    ]);
  });

  it("shows no date move when the due date stays on the same day", () => {
    const sameDay = proposal({
      from: { dueAt: "2026-12-26T18:34:00.000Z", dueOdometer: 48_400 },
      to: { dueAt: "2026-12-26T12:00:00.000Z", dueOdometer: 48_000 },
    });
    expect(buildDashboard(snapshot([oil]), NOW, [sameDay]).proposals[0].moves).toEqual([
      { from: "48,400 mi", to: "48,000 mi" },
    ]);
  });

  it("keeps applied cards, and leaves out dismissed ones and ones whose item is gone", () => {
    const dash = buildDashboard(snapshot([oil]), NOW, [
      proposal({ id: "applied", state: "applied" }),
      proposal({ id: "dismissed", state: "dismissed" }),
      proposal({ id: "orphan", itemId: "gone" }),
    ]);
    expect(dash.proposals.map((p) => [p.id, p.state])).toEqual([["applied", "applied"]]);
  });

  it("has no cards when there are no proposals", () => {
    expect(buildDashboard(snapshot([oil]), NOW).proposals).toEqual([]);
  });
});

describe("odometerDigits", () => {
  it("pads to six digit tiles", () => {
    expect(odometerDigits(48_000)).toEqual(["0", "4", "8", "0", "0", "0"]);
    expect(odometerDigits(7)).toEqual(["0", "0", "0", "0", "0", "7"]);
  });

  it("grows past six digits instead of truncating", () => {
    expect(odometerDigits(1_234_567)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("shows zeros rather than NaN or Infinity for bad input", () => {
    const zeros = ["0", "0", "0", "0", "0", "0"];
    expect(odometerDigits(Number.NaN)).toEqual(zeros);
    expect(odometerDigits(Infinity)).toEqual(zeros);
    expect(odometerDigits(-5)).toEqual(zeros);
  });
});
