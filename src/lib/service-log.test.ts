import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";
import { logService, updateOdometer } from "./service-log";
import { inDays, NOW } from "./test-support";

const VISITOR = "11111111-2222-4333-8444-555555555555";
const car = () => demoCar(NOW, VISITOR, randomUUID);
const dashItem = (snapshot: ReturnType<typeof car>, kind: string) =>
  buildDashboard(snapshot, NOW).items.find((i) => i.kind === kind)!;

describe("logService", () => {
  it("resets an overdue wash done today: last done now, due a full interval out, status OK", () => {
    const before = car();
    expect(dashItem(before, "wash").status).toBe("overdue");

    const result = logService(before, { kind: "wash" }, NOW);
    if (!result.ok) throw new Error(result.error);
    const wash = result.car.items.find((i) => i.kind === "wash")!;

    expect(wash.lastDoneAt).toBe(NOW.toISOString());
    expect(wash.lastDoneOdometer).toBe(48_000);
    expect(wash.dueAt).toBe(inDays(14));
    expect(wash.status).toBe("ok");
    expect(dashItem(result.car, "wash").status).toBe("ok");
  });

  it("restarts the mileage clock from the odometer given", () => {
    const result = logService(car(), { kind: "oil", odometer: 47_900 }, NOW);
    if (!result.ok) throw new Error(result.error);
    const oil = result.car.items.find((i) => i.kind === "oil")!;

    expect(oil.lastDoneOdometer).toBe(47_900);
    expect(oil.dueOdometer).toBe(55_400);
    expect(oil.dueAt).toBe(inDays(365));
    expect(dashItem(result.car, "oil").status).toBe("ok");
  });

  it("dates a past service on that day and estimates the odometer then, when none is given", () => {
    const result = logService(car(), { kind: "oil", date: "2026-10-15" }, NOW);
    if (!result.ok) throw new Error(result.error);
    const oil = result.car.items.find((i) => i.kind === "oil")!;

    // The reading (47,750) was taken a week before NOW, on Oct 15.
    expect(oil.lastDoneAt?.slice(0, 10)).toBe("2026-10-15");
    expect(oil.lastDoneOdometer).toBe(47_750);
    expect(oil.dueOdometer).toBe(55_250);
  });

  it("refuses a service older than the one on record, so the schedule never moves backwards", () => {
    // The demo car's last oil change was 300 days ago, on Dec 26, 2025.
    const result = logService(car(), { kind: "oil", date: "2025-10-01" }, NOW);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/older than the last one on record/) });
  });

  it("still takes a service on the same day as the one on record", () => {
    // A bare date is pinned to noon UTC, hours before a wash logged "now" at 6 pm.
    const later = new Date(NOW.getTime() + 6 * 60 * 60 * 1000);
    const today = logService(car(), { kind: "wash" }, later);
    if (!today.ok) throw new Error(today.error);
    expect(logService(today.car, { kind: "wash", date: "2026-10-22" }, later).ok).toBe(true);
  });

  it("logs a service done today at the odometer the dashboard shows, planned trips included", () => {
    const withTrip = { ...car(), plannedTripMiles: 300 };
    expect(buildDashboard(withTrip, NOW).odometerEstimate).toBe(48_300);

    const result = logService(withTrip, { kind: "oil" }, NOW);
    if (!result.ok) throw new Error(result.error);
    const oil = result.car.items.find((i) => i.kind === "oil")!;

    expect(oil.lastDoneOdometer).toBe(48_300);
    expect(oil.dueOdometer).toBe(55_800);
  });

  it("moves the odometer forward when the service mileage is past the current reading", () => {
    // Oil is due at 48,400, so 48,450 makes it overdue; the wash then resets at 48,450.
    const result = logService(car(), { kind: "wash", odometer: 48_450 }, NOW);
    if (!result.ok) throw new Error(result.error);
    const stored = Object.fromEntries(result.car.items.map((i) => [i.kind, i.status]));

    expect(result.car.vehicle.odometer).toBe(48_450);
    expect(result.car.readingAt).toBe(NOW.toISOString());
    expect(buildDashboard(result.car, NOW).odometerEstimate).toBe(48_450);
    expect(stored.oil).toBe("overdue");
    expect(stored).toEqual(Object.fromEntries(buildDashboard(result.car, NOW).items.map((i) => [i.kind, i.status])));
  });

  it("keeps the reading when the service mileage is behind it", () => {
    const before = car();
    const result = logService(before, { kind: "oil", odometer: 47_900 }, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.car.vehicle).toEqual(before.vehicle);
    expect(result.car.readingAt).toBe(before.readingAt);
  });

  it("leaves every other item and the vehicle alone", () => {
    const before = car();
    const result = logService(before, { kind: "wash" }, NOW);
    if (!result.ok) throw new Error(result.error);

    expect(result.car.vehicle).toEqual(before.vehicle);
    expect(result.car.items.filter((i) => i.kind !== "wash")).toEqual(before.items.filter((i) => i.kind !== "wash"));
  });

  it("reports what changed, with the numbers worked out by code", () => {
    const result = logService(car(), { kind: "wash" }, NOW);
    expect(result.ok && result.effect).toEqual({
      type: "service_logged",
      kind: "wash",
      label: "Exterior wash",
      doneAt: NOW.toISOString(),
      doneOdometer: 48_000,
      status: "ok",
      next: { kind: "days", dueAt: inDays(14) },
    });
  });

  it.each([
    [{ kind: "wash", date: "2026-11-30" }, /future/],
    [{ kind: "wash", date: "last week" }, /date/],
    [{ kind: "oil", odometer: -5 }, /odometer/],
    [{ kind: "oil", odometer: 48_000.5 }, /odometer/],
    [{ kind: "oil", odometer: 5_000_000 }, /odometer/],
    [{ kind: "spark_plugs" }, /item/],
  ])("refuses %o rather than storing it", (input, message) => {
    const result = logService(car(), input as never, NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });
});

describe("updateOdometer", () => {
  it("sets the reading as of now, so the dashboard shows exactly that number", () => {
    const result = updateOdometer(car(), 48_210, NOW);
    if (!result.ok) throw new Error(result.error);

    expect(result.car.vehicle.odometer).toBe(48_210);
    expect(result.car.readingAt).toBe(NOW.toISOString());
    expect(buildDashboard(result.car, NOW).odometerEstimate).toBe(48_210);
  });

  it("recomputes every status that depends on mileage, and stores the new ones", () => {
    // Oil is due at 48,400: 400 mi away is due soon, 48,450 is past it.
    const result = updateOdometer(car(), 48_450, NOW);
    if (!result.ok) throw new Error(result.error);
    const stored = Object.fromEntries(result.car.items.map((i) => [i.kind, i.status]));

    expect(stored.oil).toBe("overdue");
    expect(dashItem(result.car, "oil").status).toBe("overdue");
    expect(stored).toEqual(Object.fromEntries(buildDashboard(result.car, NOW).items.map((i) => [i.kind, i.status])));
  });

  it("can correct the reading downwards", () => {
    const result = updateOdometer(car(), 47_000, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.car.items.find((i) => i.kind === "oil")!.status).toBe("ok");
  });

  it("reports the old and new reading and every status that changed", () => {
    const result = updateOdometer(car(), 48_450, NOW);
    expect(result.ok && result.effect).toEqual({
      type: "odometer_updated",
      from: 48_000,
      to: 48_450,
      statusChanges: [{ kind: "oil", label: "Oil change (synthetic)", from: "due_soon", to: "overdue" }],
    });
  });

  it.each([-1, 48_000.5, 5_000_000, Number.NaN])("refuses %s", (miles) => {
    const result = updateOdometer(car(), miles, NOW);
    expect(!result.ok && result.error).toMatch(/odometer/);
  });
});
