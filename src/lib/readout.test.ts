import { describe, expect, it } from "vitest";
import { formatLimit, formatReadDate, intervalUsed, numberFormat, STATUS_LABEL } from "./readout";
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

  it("falls back to no due date rather than showing NaN or Infinity", () => {
    const none = { value: "—", unit: "No due date" };
    expect(formatLimit({ kind: "days", remaining: Number.NaN, inDays: Number.NaN })).toEqual(none);
    expect(formatLimit({ kind: "miles", remaining: Number.NaN, inDays: Number.NaN })).toEqual(none);
    expect(formatLimit({ kind: "miles", remaining: Infinity, inDays: Infinity })).toEqual(none);
  });
});

describe("intervalUsed with bad input", () => {
  it("is null when the interval is zero, negative or not a number", () => {
    expect(intervalUsed({ intervalDays: 0, dueAt: inDays(5) }, NOW, 48_000)).toBeNull();
    expect(intervalUsed({ intervalMiles: 0, dueOdometer: 48_400 }, NOW, 48_000)).toBeNull();
    expect(intervalUsed({ intervalDays: -14, dueAt: inDays(5) }, NOW, 48_000)).toBeNull();
    expect(intervalUsed({ intervalDays: Number.NaN, dueAt: inDays(5) }, NOW, 48_000)).toBeNull();
  });

  it("is null when the due date cannot be read", () => {
    expect(intervalUsed({ intervalDays: 14, dueAt: "not a date" }, NOW, 48_000)).toBeNull();
  });

  it("is null when the due mileage is not a number", () => {
    expect(intervalUsed({ intervalMiles: 7_500, dueOdometer: Number.NaN }, NOW, 48_000)).toBeNull();
  });

  it("skips the unusable measure and uses the other", () => {
    const item = { intervalDays: 0, dueAt: inDays(5), intervalMiles: 20_000, dueOdometer: 50_000 };
    expect(intervalUsed(item, NOW, 48_000)).toBeCloseTo(0.9, 5);
  });
});

describe("formatReadDate", () => {
  it("uses the California calendar day, whatever zone the server runs in", () => {
    // 02:00 UTC on Oct 23 is 7pm on Oct 22 in California (PDT).
    expect(formatReadDate(new Date("2026-10-23T02:00:00.000Z"))).toBe("Oct 22");
    // 07:30 UTC on Jan 15 is 11:30pm on Jan 14 in California (PST).
    expect(formatReadDate(new Date("2026-01-15T07:30:00.000Z"))).toBe("Jan 14");
  });

  it("shows a dash for a date that cannot be read", () => {
    expect(formatReadDate(new Date("not a date"))).toBe("—");
  });
});

describe("numberFormat", () => {
  it("groups thousands", () => {
    expect(numberFormat.format(48_250)).toBe("48,250");
  });
});

describe("STATUS_LABEL", () => {
  it("calls the OK state On track", () => {
    expect(STATUS_LABEL.ok).toBe("On track");
  });
});
