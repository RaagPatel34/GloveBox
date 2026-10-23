import { describe, expect, it } from "vitest";
import { DAY_MS, estimateOdometer, itemStatus, parseMiles } from "./intervals";
import { inDays, NOW } from "./test-support";

describe("estimateOdometer", () => {
  const vehicle = { odometer: 48_000, weeklyMiles: 250 };

  it("is the last reading when nothing has elapsed", () => {
    expect(estimateOdometer(vehicle, NOW, NOW)).toBe(48_000);
  });

  it("adds weekly miles for each elapsed week", () => {
    const readAt = new Date(NOW.getTime() - 14 * DAY_MS);
    expect(estimateOdometer(vehicle, readAt, NOW)).toBe(48_500);
  });

  it("prorates partial weeks", () => {
    const readAt = new Date(NOW.getTime() - 3.5 * DAY_MS);
    expect(estimateOdometer(vehicle, readAt, NOW)).toBe(48_125);
  });

  it("adds planned-trip miles on top", () => {
    const readAt = new Date(NOW.getTime() - 7 * DAY_MS);
    expect(estimateOdometer(vehicle, readAt, NOW, 300)).toBe(48_550);
  });

  it("never goes backwards if the reading is dated in the future", () => {
    const readAt = new Date(NOW.getTime() + 7 * DAY_MS);
    expect(estimateOdometer(vehicle, readAt, NOW)).toBe(48_000);
  });

  it("rounds to a whole mile", () => {
    const readAt = new Date(NOW.getTime() - 1 * DAY_MS);
    expect(estimateOdometer(vehicle, readAt, NOW)).toBe(48_036); // 35.71 -> 36
  });
});

describe("itemStatus", () => {
  it("is overdue when the due date has passed", () => {
    expect(itemStatus({ dueAt: inDays(-1) }, NOW, 48_000)).toBe("overdue");
  });

  it("is overdue when the odometer is past the due mileage", () => {
    expect(itemStatus({ dueOdometer: 47_999 }, NOW, 48_000)).toBe("overdue");
  });

  it("is overdue if either limit is passed, even when the other is far off", () => {
    expect(itemStatus({ dueAt: inDays(200), dueOdometer: 47_000 }, NOW, 48_000)).toBe("overdue");
    expect(itemStatus({ dueAt: inDays(-1), dueOdometer: 60_000 }, NOW, 48_000)).toBe("overdue");
  });

  it("is due soon within 7 days, inclusive", () => {
    expect(itemStatus({ dueAt: inDays(7) }, NOW, 48_000)).toBe("due_soon");
    expect(itemStatus({ dueAt: inDays(7.01) }, NOW, 48_000)).toBe("ok");
  });

  it("is due soon within 500 miles, inclusive", () => {
    expect(itemStatus({ dueOdometer: 48_500 }, NOW, 48_000)).toBe("due_soon");
    expect(itemStatus({ dueOdometer: 48_501 }, NOW, 48_000)).toBe("ok");
  });

  it("is due soon if either limit is close", () => {
    expect(itemStatus({ dueAt: inDays(300), dueOdometer: 48_400 }, NOW, 48_000)).toBe("due_soon");
    expect(itemStatus({ dueAt: inDays(3), dueOdometer: 90_000 }, NOW, 48_000)).toBe("due_soon");
  });

  it("is not overdue on the exact due moment or mileage", () => {
    expect(itemStatus({ dueAt: NOW.toISOString() }, NOW, 48_000)).toBe("due_soon");
    expect(itemStatus({ dueOdometer: 48_000 }, NOW, 48_000)).toBe("due_soon");
  });

  it("is ok when both limits are comfortably ahead", () => {
    expect(itemStatus({ dueAt: inDays(60), dueOdometer: 51_000 }, NOW, 48_000)).toBe("ok");
  });

  it("is ok when the item has no due target at all", () => {
    expect(itemStatus({}, NOW, 48_000)).toBe("ok");
  });
});

describe("parseMiles", () => {
  it.each([
    [48_210, 48_210],
    ["48210", 48_210],
    ["48,210", 48_210],
    [" 48 210 ", 48_210],
    ["48k", 48_000],
    ["48.2K", 48_200],
    ["31.5", 31.5],
  ])("reads %j as %d", (raw, miles) => {
    expect(parseMiles(raw)).toBe(miles);
  });

  it.each([["lots"], ["-40"], [-40], ["48,210 miles"], ["10/15"], [""], [null], [Number.NaN]])(
    "reads %j as nothing",
    (raw) => {
      expect(parseMiles(raw)).toBeUndefined();
    },
  );
});
