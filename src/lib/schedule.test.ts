import { describe, expect, it } from "vitest";
import { BASELINE_INTERVALS, DAY_MS } from "./intervals";
import { buildBaselineSchedule } from "./schedule";
import { NOW } from "./test-support";

function counter() {
  let n = 0;
  return () => `item-${++n}`;
}

describe("buildBaselineSchedule", () => {
  const build = () =>
    buildBaselineSchedule({ vehicleId: "veh-1", odometer: 48_000, readingAt: NOW }, counter());

  it("creates exactly the 8 baseline items, one per kind, for the vehicle", () => {
    const items = build();
    expect(items).toHaveLength(8);
    expect(items.map((i) => i.kind).sort()).toEqual(Object.keys(BASELINE_INTERVALS).sort());
    expect(items.every((i) => i.vehicleId === "veh-1")).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(8);
  });

  it("copies each interval from the baseline table and marks the source as baseline", () => {
    const oil = build().find((i) => i.kind === "oil")!;
    expect(oil.intervalDays).toBe(365);
    expect(oil.intervalMiles).toBe(7500);
    expect(oil.intervalSource).toEqual({ kind: "baseline" });

    const wash = build().find((i) => i.kind === "wash")!;
    expect(wash.intervalDays).toBe(14);
    expect(wash.intervalMiles).toBeUndefined();
  });

  it("starts each clock at the odometer reading: a full interval ahead, nothing overdue", () => {
    const items = build();
    const oil = items.find((i) => i.kind === "oil")!;
    expect(oil.dueOdometer).toBe(55_500);
    expect(oil.dueAt).toBe(new Date(NOW.getTime() + 365 * DAY_MS).toISOString());

    const rotation = items.find((i) => i.kind === "tire_rotation")!;
    expect(rotation.dueAt).toBeUndefined();
    expect(rotation.dueOdometer).toBe(55_500);

    expect(items.every((i) => i.status === "ok")).toBe(true);
  });

  it("does not invent a service history", () => {
    for (const item of build()) {
      expect(item.lastDoneAt).toBeUndefined();
      expect(item.lastDoneOdometer).toBeUndefined();
    }
  });
});
