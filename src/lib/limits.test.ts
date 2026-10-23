import { describe, expect, it } from "vitest";
import { milesToDays, tighterLimit } from "./limits";
import { inDays, NOW } from "./test-support";

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

describe("tighterLimit when the status is overdue or due soon", () => {
  const ODO = 48_000;

  it("shows the mileage that made it due soon when the car is barely driven", () => {
    // 450 mi is due soon (within 500), but at 10 mi/wk that is ~315 days away.
    // The date is a comfortable 20 days off, so it must not be the one shown.
    const limit = tighterLimit({ dueAt: inDays(20), dueOdometer: ODO + 450 }, NOW, ODO, 10);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(450);
  });

  it("shows the mileage that made it due soon when the car is not driven at all", () => {
    const limit = tighterLimit({ dueAt: inDays(20), dueOdometer: ODO + 450 }, NOW, ODO, 0);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(450);
  });

  it("shows the date that made it due soon, even if a mileage converts to fewer days", () => {
    // 600 mi is not due soon, but at 2,000 mi/wk it is ~2 days away. The date (6 days) is due soon.
    const limit = tighterLimit({ dueAt: inDays(6), dueOdometer: ODO + 600 }, NOW, ODO, 2_000);
    expect(limit?.kind).toBe("days");
    expect(limit?.remaining).toBe(6);
  });

  it("shows the date that made it overdue, even if the mileage is only due soon", () => {
    const limit = tighterLimit({ dueAt: inDays(-1), dueOdometer: ODO + 100 }, NOW, ODO, 2_000);
    expect(limit?.kind).toBe("days");
    expect(limit?.remaining).toBe(-1);
  });

  it("shows the mileage that made it overdue, even if the date is only due soon", () => {
    const limit = tighterLimit({ dueAt: inDays(2), dueOdometer: ODO - 10 }, NOW, ODO, 10);
    expect(limit?.kind).toBe("miles");
    expect(limit?.remaining).toBe(-10);
  });

  it("shows the most urgent of two limits that are both due soon", () => {
    // 100 mi at 250/wk is ~2.8 days; the date is 5 days off.
    const limit = tighterLimit({ dueAt: inDays(5), dueOdometer: ODO + 100 }, NOW, ODO, 250);
    expect(limit?.kind).toBe("miles");
  });

  it("stays on whichever runs out first when everything is OK", () => {
    const byMiles = tighterLimit({ dueAt: inDays(60), dueOdometer: ODO + 1_000 }, NOW, ODO, 250);
    expect(byMiles?.kind).toBe("miles"); // ~28 days
    const byDate = tighterLimit({ dueAt: inDays(20), dueOdometer: ODO + 5_000 }, NOW, ODO, 250);
    expect(byDate?.kind).toBe("days");
  });
});

describe("tighterLimit with bad input", () => {
  const ODO = 48_000;

  it("ignores a date that cannot be read and falls back to the mileage", () => {
    const limit = tighterLimit({ dueAt: "not a date", dueOdometer: ODO + 400 }, NOW, ODO, 250);
    expect(limit?.kind).toBe("miles");
  });

  it("has nothing to show when the only target is unreadable", () => {
    expect(tighterLimit({ dueAt: "not a date" }, NOW, ODO, 250)).toBeNull();
    expect(tighterLimit({ dueOdometer: Number.NaN }, NOW, ODO, 250)).toBeNull();
  });

  it("treats unusable weekly miles as a car that is not driven", () => {
    expect(milesToDays(500, Number.NaN)).toBe(Infinity);
    expect(milesToDays(-5, Number.NaN)).toBe(-Infinity);
  });
});
