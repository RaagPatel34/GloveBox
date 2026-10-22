export type TripInput = { miles: number; mpg: number; gallons: number; usualPrice: number; alternatePrice: number; extraMiles: number; extraMinutes: number; hourlyValue: number };
export function calculateTrip(input: TripInput) {
  const limits: Record<keyof TripInput, [number,number]> = { miles: [0,10000], mpg:[1,150], gallons:[0.1,100], usualPrice:[0.01,30], alternatePrice:[0.01,30], extraMiles:[0,1000], extraMinutes:[0,1440], hourlyValue:[0,1000] };
  for (const key of Object.keys(limits) as (keyof TripInput)[]) {
    const [min,max] = limits[key];
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`Check ${key}: expected ${min}–${max}.`);
  }
  const purchaseSavings = (input.usualPrice - input.alternatePrice) * input.gallons;
  // Value extra fuel at the usual price for a conservative, explicit comparison.
  const detourFuelCost = input.extraMiles / input.mpg * input.usualPrice;
  const netFuelSavings = purchaseSavings - detourFuelCost;
  const timeCost = input.extraMinutes / 60 * input.hourlyValue;
  const netAfterTime = netFuelSavings - timeCost;
  return { baselineFuelCost: input.miles / input.mpg * input.usualPrice, totalMiles: input.miles + input.extraMiles, purchaseSavings, detourFuelCost, netFuelSavings, timeCost, netAfterTime, breakEvenExtraMiles: Math.max(0, (purchaseSavings - timeCost) * input.mpg / input.usualPrice), worthIt: netAfterTime > 0.005 };
}
