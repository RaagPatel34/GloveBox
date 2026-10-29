import { describe, expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import { dueBasis, garageToSnapshot, legacyHashRoute, SOURCE_TEXT, wheelPlan } from "./garage-view";
import { demoGarage } from "./maintenance";
import { formatLimit } from "./readout";
import { NOW } from "./test-support";

describe("garageToSnapshot", () => {
  it("carries the car, its items, planned miles and reading time", () => {
    const garage = { ...demoGarage(NOW), plannedTripMiles: 120 };
    const snapshot = garageToSnapshot(garage, NOW);
    expect(snapshot.vehicle).toBe(garage.vehicle);
    expect(snapshot.items).toBe(garage.items);
    expect(snapshot.plannedTripMiles).toBe(120);
    expect(snapshot.readingAt).toBe(garage.readingAt);
  });

  it("feeds the dashboard the demo car's odometer", () => {
    expect(buildDashboard(garageToSnapshot(demoGarage(NOW), NOW), NOW, []).odometerEstimate).toBe(48000);
  });

  it("reads an older backup without a reading time as read now, not NaN", () => {
    const snapshot = garageToSnapshot({ ...demoGarage(NOW), readingAt: undefined }, NOW);
    expect(snapshot.readingAt).toBe(NOW.toISOString());
    expect(buildDashboard(snapshot, NOW, []).odometerEstimate).toBe(48000);
  });

  it("gives a new car with no history an item that reads No due date", () => {
    const garage = demoGarage(NOW);
    const bare = { ...garage, items: garage.items.map((item) => ({ ...item, dueAt: undefined, dueOdometer: undefined, lastDoneAt: undefined })) };
    const dashboard = buildDashboard(garageToSnapshot(bare, NOW), NOW, []);
    expect(dashboard.items[0].status).toBe("unknown");
    expect(formatLimit(dashboard.items[0].limit)).toEqual({ value: "—", unit: "No due date" });
  });
});

describe("SOURCE_TEXT", () => {
  it("names every interval source in words", () => {
    expect(SOURCE_TEXT).toEqual({
      baseline: "Illustrative baseline",
      manufacturer: "Manufacturer schedule",
      user: "Your record",
      nhtsa: "NHTSA guidance",
    });
  });
});

describe("dueBasis", () => {
  const wash = demoGarage(NOW).items[0];

  it("explains a baseline date from the interval and the last service", () => {
    expect(
      dueBasis({ ...wash, intervalDays: 14, lastDoneAt: "2026-10-02T19:00:00.000Z", intervalSource: { kind: "baseline" } }),
    ).toBe(
      "Illustrative baseline: every 14 days, counted from your last one on Oct 2. Check your owner’s manual for your car’s schedule.",
    );
  });

  it("says so when there is no interval and no service on record", () => {
    expect(dueBasis({ ...wash, intervalDays: undefined, lastDoneAt: undefined, intervalSource: { kind: "user" } })).toBe("Your record. No service recorded yet.");
  });

  it("names the interval even before the first service", () => {
    expect(dueBasis({ ...wash, lastDoneAt: undefined, intervalMiles: 5000, intervalSource: { kind: "user" } })).toBe(
      "Your record: every 14 days or 5,000 mi. No service recorded yet.",
    );
  });
});

describe("wheelPlan", () => {
  it("spins the ones wheel two extra turns and the tens one, keeping separators", () => {
    expect(wheelPlan("48,000")).toEqual([
      { kind: "digit", digit: 4, turns: 0 },
      { kind: "digit", digit: 8, turns: 0 },
      { kind: "sep", char: "," },
      { kind: "digit", digit: 0, turns: 0 },
      { kind: "digit", digit: 0, turns: 1 },
      { kind: "digit", digit: 0, turns: 2 },
    ]);
  });

  it("keeps every digit of a seven-digit odometer", () => {
    expect(wheelPlan("1048000").filter((entry) => entry.kind === "digit")).toHaveLength(7);
  });

  it("turns a two-digit value's tens once and ones twice", () => {
    expect(wheelPlan("12")).toEqual([
      { kind: "digit", digit: 1, turns: 1 },
      { kind: "digit", digit: 2, turns: 2 },
    ]);
  });
});

describe("legacyHashRoute", () => {
  it("sends the old tab hashes to their pages", () => {
    expect(legacyHashRoute("#records")).toBe("/log");
    expect(legacyHashRoute("#trips")).toBe("/trips");
    expect(legacyHashRoute("#guidance")).toBe("/car");
    expect(legacyHashRoute("#overview")).toBe("/");
  });

  it("leaves other hashes alone", () => {
    expect(legacyHashRoute("")).toBeNull();
    expect(legacyHashRoute("#main")).toBeNull();
  });
});
