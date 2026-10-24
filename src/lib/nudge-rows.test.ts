import { describe, expect, it } from "vitest";
import { nudgeFromRow, nudgeToRow } from "./nudge-rows";
import type { Nudge } from "./types";

const nudge: Nudge = {
  id: "n1",
  vehicleId: "v1",
  text: "Rain Saturday, wash Sunday.",
  reason: "Open-Meteo forecasts 0.31 in of rain on Saturday.",
  createdAt: "2026-10-22T12:00:00.000Z",
};

describe("nudge rows", () => {
  it("maps a nudge to flat columns and back", () => {
    const row = nudgeToRow(nudge);
    expect(row).toEqual({
      id: "n1",
      vehicle_id: "v1",
      text: "Rain Saturday, wash Sunday.",
      reason: "Open-Meteo forecasts 0.31 in of rain on Saturday.",
      created_at: "2026-10-22T12:00:00.000Z",
    });
    expect(nudgeFromRow(row)).toEqual(nudge);
  });

  it("reads the Date the neon driver returns for timestamptz", () => {
    const row = { ...nudgeToRow(nudge), created_at: new Date("2026-10-22T12:00:00.000Z") };
    expect(nudgeFromRow(row).createdAt).toBe("2026-10-22T12:00:00.000Z");
  });
});
