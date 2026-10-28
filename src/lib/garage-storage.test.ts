import { describe, expect, it } from "vitest";
import { parseStoredGarage } from "./garage-storage";
import { demoGarage } from "./maintenance";
import { NOW } from "./test-support";

const CORRUPT = { garage: null, error: "Saved data could not be restored. Load a fresh demo to continue." };

describe("parseStoredGarage", () => {
  it("finds no garage and no problem when nothing is saved", () => {
    expect(parseStoredGarage(null)).toEqual({ garage: null, error: null });
  });

  it("restores a saved garage", () => {
    const garage = demoGarage(NOW);
    expect(parseStoredGarage(JSON.stringify(garage))).toEqual({ garage, error: null });
  });

  it("reports saved text that is not JSON", () => {
    expect(parseStoredGarage("{bad")).toEqual(CORRUPT);
  });

  it("reports JSON that is not a garage", () => {
    expect(parseStoredGarage(JSON.stringify({ version: 2 }))).toEqual(CORRUPT);
  });
});
