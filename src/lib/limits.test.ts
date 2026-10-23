import { describe, expect, it } from "vitest";
import { milesToDays, tighterLimit } from "./limits";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-22T12:00:00.000Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY_MS).toISOString();

describe("milesToDays", () => {
  it("converts miles to days at the weekly-miles rate", () => {
    expect(milesToDays(250, 250)).toBe(7);
    expect(milesToDays(100, 140)).toBe(5); // 20 mi/day
  });

  it("keeps the sign for miles already passed", () => {
    expect(milesToDays(-50, 350)).toBe(-1);
  });

  it("never runs out by mileage if the car is not driven", () => {
    expect(milesToDays(500, 0)).toBe(Infinity);
  });

  it("is already past due if the car is not driven but the mileage has been passed", () => {
    expect(milesToDays(-1, 0)).toBe(-Infinity);
  });

  it("treats the due mileage itself as zero days", () => {
    expect(milesToDays(0, 0)).toBe(0);
    expect(milesToDays(0, 250)).toBe(0);
  });
});

describe("tighterLimit", () => {
  const WEEKLY = 250;
  const ODO = 48_000;

  it("shows the date when only a date is set", () => {
    expect(tighterLimit({ dueAt: inDays(12) }, NOW, ODO, WEEKLY)).toEqual({
      kind: "days",
      remaining: 12,
      inDays: 12,
    });
  });

  it("shows how late a date is as a negative number", () => {
    expect(tighterLimit({ dueAt: inDays(-12) }, NOW, ODO, WEEKLY)).toEqual({
      kind: "days",
      remaining: -12,
      inDays: -12,
    });
  });

  it("shows the mileage when only a mileage is set", () => {
    const limit = tighterLimit({ dueOdometer: 48_400 }, NOW, ODO, WEEKLY);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(400);
    expect(limit?.inDays).toBeCloseTo(11.2, 5);
  });

  it("picks the mileage when it runs out before the date", () => {
    // 400 mi at 250/wk is ~11 days; the date is 65 days off.
    const limit = tighterLimit({ dueAt: inDays(65), dueOdometer: 48_400 }, NOW, ODO, WEEKLY);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(400);
  });

  it("picks the date when it runs out before the mileage", () => {
    const limit = tighterLimit({ dueAt: inDays(5), dueOdometer: 50_000 }, NOW, ODO, WEEKLY);
    expect(limit?.kind).toBe("days");
    expect(limit?.remaining).toBe(5);
  });

  it("picks the date on a tie", () => {
    const limit = tighterLimit({ dueAt: inDays(7), dueOdometer: 48_250 }, NOW, ODO, WEEKLY);
    expect(limit?.kind).toBe("days");
  });

  it("picks whichever is further past due when both are passed", () => {
    // 100 mi over is ~2.8 days late; the date is 1 day late.
    const limit = tighterLimit({ dueAt: inDays(-1), dueOdometer: 47_900 }, NOW, ODO, WEEKLY);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(-100);
  });

  it("picks an overdue mileage over a comfortable date when the car is not driven", () => {
    const limit = tighterLimit({ dueAt: inDays(30), dueOdometer: 47_000 }, NOW, ODO, 0);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(-1000);
  });

  it("picks the date when the car is not driven and the mileage is still ahead", () => {
    const limit = tighterLimit({ dueAt: inDays(30), dueOdometer: 60_000 }, NOW, ODO, 0);
    expect(limit?.kind).toBe("days");
  });

  it("has nothing to show when the item has no due target", () => {
    expect(tighterLimit({}, NOW, ODO, WEEKLY)).toBeNull();
  });
});
