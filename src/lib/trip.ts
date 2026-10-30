import type { DetourVerdict, TripStop, Vehicle } from "./types";

// Different businesses can share an address. Planning and rendering use the same identity.
export const tripPlaceKey = (place: Omit<TripStop, "type">) => JSON.stringify([place.name, place.label, place.lat, place.lng]);

// True when an amount shows as at least a cent once rounded, so a verdict agrees with the money
// on screen: $0.004 is "even", not a saving.
export const atLeastACent = (amount: number) => amount > 0.005;

// Throws naming the first input outside its range.
function checkLimits<K extends string>(input: Record<K, number>, limits: Record<K, [number, number]>) {
  for (const key of Object.keys(limits) as K[]) {
    const [min, max] = limits[key];
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`Check ${key}: expected ${min}–${max}.`);
  }
}

// Filling up at a cheaper station: what the price difference saves, what the extra miles cost,
// and the difference. The extra fuel is valued at the usual price, a conservative comparison.
function fillUpSavings(input: { usualPrice: number; cheaperPrice: number; gallons: number; extraMiles: number; mpg: number }) {
  const savings = (input.usualPrice - input.cheaperPrice) * input.gallons;
  const detourCost = input.extraMiles / input.mpg * input.usualPrice;
  return { savings, detourCost, net: savings - detourCost };
}

export type TripInput = { miles: number; mpg: number; gallons: number; usualPrice: number; alternatePrice: number; extraMiles: number; extraMinutes: number; hourlyValue: number };
export function calculateTrip(input: TripInput) {
  checkLimits(input, { miles: [0,10000], mpg:[1,150], gallons:[0.1,100], usualPrice:[0.01,30], alternatePrice:[0.01,30], extraMiles:[0,1000], extraMinutes:[0,1440], hourlyValue:[0,1000] });
  const { savings: purchaseSavings, detourCost: detourFuelCost, net: netFuelSavings } = fillUpSavings({ ...input, cheaperPrice: input.alternatePrice });
  const timeCost = input.extraMinutes / 60 * input.hourlyValue;
  const netAfterTime = netFuelSavings - timeCost;
  return { baselineFuelCost: input.miles / input.mpg * input.usualPrice, totalMiles: input.miles + input.extraMiles, purchaseSavings, detourFuelCost, netFuelSavings, timeCost, netAfterTime, breakEvenExtraMiles: Math.max(0, (purchaseSavings - timeCost) * input.mpg / input.usualPrice), worthIt: atLeastACent(netAfterTime) };
}
// The MPG to cost a drive at: the real-world figure the driver set, else the EPA one.
export const vehicleMpg = (vehicle: Pick<Vehicle, "epaMpg" | "mpgOverride">) => vehicle.mpgOverride || vehicle.epaMpg;

// Is a cheaper station worth the extra miles to reach it? Plain math, so the verdict is never
// the model's arithmetic. The extra fuel is valued at the usual station's price.
export type DetourInput = { station: string; usualPrice: number; stationPrice: number; gallons: number; extraMiles: number; mpg: number };
export function detourWorthIt(input: DetourInput): DetourVerdict {
  const { station, ...amounts } = input;
  checkLimits(amounts, { usualPrice: [0.01, 30], stationPrice: [0.01, 30], gallons: [0.1, 100], extraMiles: [0, 1000], mpg: [1, 150] });
  const { savings, detourCost, net } = fillUpSavings({ ...amounts, cheaperPrice: amounts.stationPrice });
  // Worth it only when the net shows as at least a cent, so the verdict agrees with the card.
  return { station, savings, detourCost, net, worthIt: atLeastACent(net) };
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
