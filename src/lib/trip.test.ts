import { describe, expect, it } from "vitest";
import { detourWorthIt } from "./trip";

describe("detourWorthIt", () => {
  const base = { station: "Costco", usualPrice: 4.5, stationPrice: 4.2, gallons: 12, extraMiles: 3, mpg: 30 };

  it("says a cheaper station is worth the detour when the savings beat the extra fuel", () => {
    // 0.30 × 12 gal = $3.60 saved; 3 mi ÷ 30 mpg × $4.50 = $0.45 to get there.
    const verdict = detourWorthIt(base);
    expect(verdict.station).toBe("Costco");
    expect(verdict.savings).toBeCloseTo(3.6, 6);
    expect(verdict.detourCost).toBeCloseTo(0.45, 6);
    expect(verdict.net).toBeCloseTo(3.15, 6);
    expect(verdict.worthIt).toBe(true);
  });

  it("says a small saving is not worth a long detour", () => {
    // 0.10 × 10 gal = $1.00 saved; 15 mi ÷ 25 mpg × $4.50 = $2.70 to get there.
    const verdict = detourWorthIt({ ...base, stationPrice: 4.4, gallons: 10, extraMiles: 15, mpg: 25 });
    expect(verdict.savings).toBeCloseTo(1, 6);
    expect(verdict.detourCost).toBeCloseTo(2.7, 6);
    expect(verdict.net).toBeCloseTo(-1.7, 6);
    expect(verdict.worthIt).toBe(false);
  });

  it("is not worth it when the saving exactly equals the detour cost", () => {
    // 1.00 × 3 gal = $3.00 saved; 22.5 mi ÷ 30 mpg × $4.00 = $3.00 to get there.
    const verdict = detourWorthIt({ station: "Shell", usualPrice: 4, stationPrice: 3, gallons: 3, extraMiles: 22.5, mpg: 30 });
    expect(verdict.net).toBe(0);
    expect(verdict.worthIt).toBe(false);
  });

  it("is not worth it when the net saving rounds to nothing on screen", () => {
    // 0.1¢ × 4 gal = $0.004 saved, shown as $0.00.
    const verdict = detourWorthIt({ station: "Arco", usualPrice: 4, stationPrice: 3.999, gallons: 4, extraMiles: 0, mpg: 30 });
    expect(verdict.net).toBeCloseTo(0.004, 6);
    expect(verdict.worthIt).toBe(false);
  });

  it("shows negative savings and says no when the other station is pricier", () => {
    const verdict = detourWorthIt({ ...base, stationPrice: 4.7, gallons: 10, extraMiles: 0 });
    expect(verdict.savings).toBeCloseTo(-2, 6);
    expect(verdict.detourCost).toBe(0);
    expect(verdict.worthIt).toBe(false);
  });

  it.each([
    ["mpg", { mpg: 0 }],
    ["mpg", { mpg: 151 }],
    ["usualPrice", { usualPrice: 0 }],
    ["usualPrice", { usualPrice: 31 }],
    ["stationPrice", { stationPrice: -1 }],
    ["stationPrice", { stationPrice: Number.NaN }],
    ["gallons", { gallons: 0 }],
    ["gallons", { gallons: 101 }],
    ["extraMiles", { extraMiles: -1 }],
    ["extraMiles", { extraMiles: Number.POSITIVE_INFINITY }],
  ])("refuses a bad %s instead of returning a verdict", (field, bad) => {
    expect(() => detourWorthIt({ ...base, ...bad })).toThrow(`Check ${field}`);
  });
});
