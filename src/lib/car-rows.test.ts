import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fromRows, toRows } from "./car-rows";
import { demoCar } from "./fixtures/demo-car";
import { NOW } from "./test-support";

const demoFor = (visitorId: string) => demoCar(NOW, visitorId, randomUUID);

describe("toRows", () => {
  const snapshot = demoFor("3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11");
  const rows = toRows("3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11", snapshot);

  it("flattens the vehicle into snake_case columns keyed by the visitor", () => {
    expect(rows.vehicle).toMatchObject({
      id: snapshot.vehicle.id,
      visitor_id: "3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11",
      year: 2019,
      make: "Honda",
      model: "Civic",
      epa_mpg: 34,
      mpg_override: null,
      odometer: 47_750,
      weekly_miles: 250,
      home_label: "Knott's Berry Farm, Buena Park, CA",
      home_lat: 33.8442,
      home_lng: -117.9987,
      reading_at: "2026-10-15T12:00:00.000Z",
    });
  });

  it("maps absent optional values to null and the interval source to two columns", () => {
    const wash = rows.items.find((r) => r.kind === "wash")!;
    expect(wash.interval_miles).toBeNull();
    expect(wash.due_odometer).toBeNull();
    expect(wash.interval_source_kind).toBe("baseline");
    expect(wash.interval_source_url).toBeNull();

    const cabin = rows.items.find((r) => r.kind === "cabin_filter")!;
    expect(cabin.interval_miles).toBe(12_000);
    expect(cabin.interval_source_kind).toBe("manufacturer");
    expect(cabin.interval_source_url).toContain("owners.honda.com");
  });
});

describe("fromRows", () => {
  it("rebuilds the same snapshot that was stored", () => {
    const snapshot = demoFor("3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11");
    const { vehicle, items } = toRows("3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11", snapshot);
    const back = fromRows(vehicle, items);
    // The visitor on the rebuilt vehicle is the one the rows were keyed by.
    expect(back).toEqual({
      ...snapshot,
      vehicle: { ...snapshot.vehicle, visitorId: "3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11" },
    });
  });

  it("accepts what Postgres drivers hand back: Date timestamps and string numerics", () => {
    const snapshot = demoFor("v");
    const { vehicle, items } = toRows("v", snapshot);
    const driverVehicle = {
      ...vehicle,
      epa_mpg: "34",
      home_lat: "33.8442",
      home_lng: "-117.9987",
      reading_at: new Date(vehicle.reading_at),
    };
    const driverItems = items.map((i) => ({
      ...i,
      due_at: i.due_at === null ? null : new Date(i.due_at),
      last_done_at: i.last_done_at === null ? null : new Date(i.last_done_at),
    }));
    const back = fromRows(driverVehicle, driverItems);
    expect(back.vehicle.epaMpg).toBe(34);
    expect(back.vehicle.home.lat).toBe(33.8442);
    expect(back.readingAt).toBe(snapshot.readingAt);
    expect(back.items.find((i) => i.kind === "oil")?.dueAt).toBe(snapshot.items.find((i) => i.kind === "oil")?.dueAt);
  });
});
