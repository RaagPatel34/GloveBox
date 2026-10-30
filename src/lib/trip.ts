import type { DetourVerdict, TripStop, Vehicle } from "./types";

// Different businesses can share an address. Planning and rendering use the same identity.
export const tripPlaceKey = (place: Omit<TripStop, "type">) => JSON.stringify([place.name, place.label, place.lat, place.lng]);

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
// The MPG to cost a drive at: the real-world figure the driver set, else the EPA one.
export const vehicleMpg = (vehicle: Pick<Vehicle, "epaMpg" | "mpgOverride">) => vehicle.mpgOverride || vehicle.epaMpg;

// Is a cheaper station worth the extra miles to reach it? Plain math, so the verdict is never
// the model's arithmetic. The extra fuel is valued at the usual station's price.
export type DetourInput = { station: string; usualPrice: number; stationPrice: number; gallons: number; extraMiles: number; mpg: number };
export function detourWorthIt(input: DetourInput): DetourVerdict {
  const limits: Record<Exclude<keyof DetourInput, "station">, [number, number]> = { usualPrice: [0.01, 30], stationPrice: [0.01, 30], gallons: [0.1, 100], extraMiles: [0, 1000], mpg: [1, 150] };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const [min, max] = limits[key];
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`Check ${key}: expected ${min}–${max}.`);
  }
  const savings = (input.usualPrice - input.stationPrice) * input.gallons;
  const detourCost = input.extraMiles / input.mpg * input.usualPrice;
  const net = savings - detourCost;
  // Worth it only when the net shows as at least a cent, so the verdict agrees with the card.
  return { station: input.station, savings, detourCost, net, worthIt: net > 0.005 };
}

// The most stops the trip agent plans in one drive.
export const MAX_TRIP_STOPS = 8;

// The fuel a drive burns, in dollars: miles ÷ MPG × price per gallon. Plain math, so the
// trip agent's cost is never the model's arithmetic.
export function tripCost(miles: number, mpg: number, pricePerGal: number): number {
  if (!Number.isFinite(miles) || miles < 0 || miles > 10000) throw new Error('Check miles: expected 0–10000.');
  if (!Number.isFinite(mpg) || mpg < 1 || mpg > 150) throw new Error('Check mpg: expected 1–150.');
  if (!Number.isFinite(pricePerGal) || pricePerGal < 0.01 || pricePerGal > 30) throw new Error('Check price: expected $0.01–$30 per gallon.');
  return miles / mpg * pricePerGal;
}
