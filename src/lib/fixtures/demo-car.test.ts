import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDashboard } from "../dashboard";
import { demoCar } from "./demo-car";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const VISITOR = "11111111-2222-4333-8444-555555555555";

describe("demoCar", () => {
  const car = demoCar(NOW, VISITOR, randomUUID);
  const dash = buildDashboard(car, NOW);
  const byKind = Object.fromEntries(dash.items.map((i) => [i.kind, i]));

  it("is the spec's 2019 Honda Civic at about 48,000 miles, 250 miles a week", () => {
    expect(car.vehicle).toMatchObject({ year: 2019, make: "Honda", weeklyMiles: 250 });
    expect(dash.odometerEstimate).toBe(48_000);
  });

  it("has one item for each of the 8 schedule kinds", () => {
    expect(dash.items.map((i) => i.kind).sort()).toEqual(
      ["brake_check", "cabin_filter", "engine_filter", "oil", "tire_pressure", "tire_rotation", "wash", "wipers"],
    );
  });

  it("has the wash overdue (last done 26 days ago)", () => {
    expect(byKind.wash.status).toBe("overdue");
    expect(byKind.wash.limit).toMatchObject({ kind: "days", remaining: -12 });
  });

  it("has the oil change due soon, about 400 miles away", () => {
    expect(byKind.oil.status).toBe("due_soon");
    expect(byKind.oil.limit).toMatchObject({ kind: "miles", remaining: 400 });
  });

  it("has everything else OK", () => {
    const others = dash.items.filter((i) => i.kind !== "wash" && i.kind !== "oil");
    expect(others.map((i) => i.status)).toEqual(others.map(() => "ok"));
  });

  it("stays the same however late in the day it is loaded", () => {
    const later = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    const counts = buildDashboard(demoCar(later, VISITOR, randomUUID), later).counts;
    expect(counts).toEqual({ overdue: 1, due_soon: 1, ok: 6, unknown: 0 });
  });

  it("includes one manufacturer-sourced interval", () => {
    expect(dash.items.filter((i) => i.source.kind === "manufacturer")).toHaveLength(1);
  });

  it("belongs to the visitor who loaded it", () => {
    expect(car.vehicle.visitorId).toBe(VISITOR);
  });

  it("is based at a public landmark, not anyone's address", () => {
    expect(car.vehicle.home.label).toBe("Knott's Berry Farm, Buena Park, CA");
  });

  it("gives every load fresh ids, so two visitors (or one visitor twice) never collide on a primary key", () => {
    const other = demoCar(NOW, "99999999-8888-4777-8666-555555555555", randomUUID);
    const ids = (c: typeof car) => [c.vehicle.id, ...c.items.map((i) => i.id)];
    expect(ids(car).filter((id) => ids(other).includes(id))).toEqual([]);
    expect(new Set(ids(car)).size).toBe(ids(car).length);
  });

  it("links every item to its vehicle", () => {
    expect(car.items.map((i) => i.vehicleId)).toEqual(car.items.map(() => car.vehicle.id));
  });

  it("stores the same status the dashboard shows, so nothing else reads a wrong one from the database", () => {
    const stored = Object.fromEntries(car.items.map((i) => [i.kind, i.status]));
    expect(stored).toEqual(Object.fromEntries(dash.items.map((i) => [i.kind, i.status])));
  });
});
