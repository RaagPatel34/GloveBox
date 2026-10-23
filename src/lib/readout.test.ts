import { describe, expect, it } from "vitest";
import { formatLimit, intervalUsed } from "./readout";
import { inDays, NOW } from "./test-support";

describe("intervalUsed", () => {
  it("is the share of the day interval that has elapsed", () => {
    // 14-day interval, due in 4 days: 10 days used.
    const used = intervalUsed({ intervalDays: 14, dueAt: inDays(4) }, NOW, 48_000);
    expect(used).toBeCloseTo(10 / 14, 5);
  });

  it("is the share of the mileage interval driven", () => {
    // 20,000 mi interval, due at 50,000, now 48,000: 18,000 used.
    const used = intervalUsed({ intervalMiles: 20_000, dueOdometer: 50_000 }, NOW, 48_000);
    expect(used).toBeCloseTo(0.9, 5);
  });

  it("uses whichever of time or miles is further along", () => {
    const item = { intervalDays: 365, dueAt: inDays(300), intervalMiles: 7_500, dueOdometer: 48_400 };
    // time: 65/365 = 0.18; miles: 7100/7500 = 0.947
    expect(intervalUsed(item, NOW, 48_000)).toBeCloseTo(7_100 / 7_500, 5);
  });

  it("goes past 1 when overdue", () => {
    const used = intervalUsed({ intervalDays: 14, dueAt: inDays(-12) }, NOW, 48_000);
    expect(used).toBeCloseTo(26 / 14, 5);
  });

  it("never goes below 0", () => {
    // Due date pushed further out than a full interval from now.
    expect(intervalUsed({ intervalDays: 14, dueAt: inDays(30) }, NOW, 48_000)).toBe(0);
  });

  it("is null when there is no interval to measure against", () => {
    expect(intervalUsed({ dueAt: inDays(5) }, NOW, 48_000)).toBeNull();
    expect(intervalUsed({ intervalDays: 14 }, NOW, 48_000)).toBeNull();
    expect(intervalUsed({}, NOW, 48_000)).toBeNull();
  });
});

describe("formatLimit", () => {
  it("writes out miles left", () => {
    expect(formatLimit({ kind: "miles", remaining: 223, inDays: 6 })).toEqual({ value: "223", unit: "mi left" });
  });

  it("writes out miles over, with a thousands separator", () => {
    expect(formatLimit({ kind: "miles", remaining: -1234, inDays: -30 })).toEqual({ value: "1,234", unit: "mi over" });
  });

  it("writes out whole days left, rounding down", () => {
    expect(formatLimit({ kind: "days", remaining: 12.9, inDays: 12.9 })).toEqual({ value: "12", unit: "days left" });
    expect(formatLimit({ kind: "days", remaining: 1.5, inDays: 1.5 })).toEqual({ value: "1", unit: "day left" });
  });

  it("says Today when less than a day is left", () => {
    expect(formatLimit({ kind: "days", remaining: 0.4, inDays: 0.4 })).toEqual({ value: "Today", unit: "" });
    expect(formatLimit({ kind: "days", remaining: 0, inDays: 0 })).toEqual({ value: "Today", unit: "" });
  });

  it("writes out days late, rounding up so a late item never reads as zero", () => {
    expect(formatLimit({ kind: "days", remaining: -12, inDays: -12 })).toEqual({ value: "12", unit: "days late" });
    expect(formatLimit({ kind: "days", remaining: -0.3, inDays: -0.3 })).toEqual({ value: "1", unit: "day late" });
    expect(formatLimit({ kind: "days", remaining: -1.2, inDays: -1.2 })).toEqual({ value: "2", unit: "days late" });
  });

  it("says so when there is no due target", () => {
    expect(formatLimit(null)).toEqual({ value: "—", unit: "No due date" });
  });
});
