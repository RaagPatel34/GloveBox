import { describe, expect, it } from "vitest";
import { garageSaved, garageUpdated, resetToDemo, undoReset } from "./garage-session";
import { demoGarage, type Garage } from "./maintenance";
import { NOW } from "./test-support";

const mine: Garage = { ...demoGarage(NOW), plannedTripMiles: 300 };
const demo = demoGarage(NOW);

describe("resetToDemo and undoReset", () => {
  it("keeps the replaced garage so the reset can be undone", () => {
    const afterReset = resetToDemo({ garage: mine, beforeReset: null }, demo);
    expect(afterReset).toEqual({ garage: demo, beforeReset: mine });
    expect(undoReset(afterReset)).toEqual({ garage: mine, beforeReset: null });
  });

  it("offers no undo once something else has been saved after the reset", () => {
    const afterReset = resetToDemo({ garage: mine, beforeReset: null }, demo);
    const logged = { ...demo, plannedTripMiles: 50 };
    const afterSave = garageSaved(afterReset, logged);
    expect(afterSave.beforeReset).toBeNull();
    expect(undoReset(afterSave)).toEqual(afterSave);
  });
});

describe("garageUpdated", () => {
  it("applies a change to the garage as it is now, not as it was when the change started", () => {
    // A slow drive review started on `mine`; meanwhile the planned miles changed.
    const meanwhile = garageSaved({ garage: mine, beforeReset: null }, { ...mine, plannedTripMiles: 900 });
    const afterReview = garageUpdated(meanwhile, (garage) => ({ ...garage, proposals: [] }));
    expect(afterReview.garage?.plannedTripMiles).toBe(900);
  });

  it("changes nothing when there is no garage", () => {
    const empty = { garage: null, beforeReset: null };
    expect(garageUpdated(empty, (garage) => garage)).toBe(empty);
  });
});

describe("garageUpdated with a change that changes nothing", () => {
  it("keeps the session, so Undo survives and nothing is saved again", () => {
    const afterReset = resetToDemo({ garage: mine, beforeReset: null }, demo);
    expect(garageUpdated(afterReset, (garage) => garage)).toBe(afterReset);
  });
});
