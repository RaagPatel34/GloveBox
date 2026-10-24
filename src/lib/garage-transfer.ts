import { isGarage, type Garage } from './maintenance';

// The server assigns every database identity. Local IDs can be short names or
// demo fixtures and must never collide with another visitor's database rows.
export function prepareTransfer(value: unknown, visitorId: string, newId = () => crypto.randomUUID(), now = new Date()): Garage & { readingAt: string } {
  if (!isGarage(value)) throw new Error('This is not a valid GloveBox garage.');
  const garage = structuredClone(value);
  const v = garage.vehicle;
  if (!Number.isInteger(v.year) || v.year < 1984 || v.year > now.getFullYear() + 1 ||
    !Number.isInteger(v.odometer) || !Number.isInteger(v.weeklyMiles) || v.weeklyMiles > 2000 || v.epaMpg > 150 ||
    !Number.isFinite(v.home.lat) || Math.abs(v.home.lat) > 90 || !Number.isFinite(v.home.lng) || Math.abs(v.home.lng) > 180)
    throw new Error('Check the vehicle year, whole-mile readings, MPG, and location before copying.');
  const kinds = new Set<string>();
  for (const item of garage.items) {
    if (kinds.has(item.kind)) throw new Error('Only one reminder per maintenance item can be copied.');
    kinds.add(item.kind);
    for (const n of [item.intervalDays, item.intervalMiles, item.lastDoneOdometer, item.dueOdometer])
      if (n !== undefined && !Number.isInteger(n)) throw new Error('Cloud reminders require whole days and miles.');
  }
  const vehicleId = newId();
  const ids = new Map(garage.items.map(i => [i.id, newId()]));
  garage.vehicle = { ...v, id: vehicleId, visitorId };
  garage.items = garage.items.map(i => ({ ...i, id: ids.get(i.id)!, vehicleId, status: 'unknown' }));
  garage.services = garage.services?.map(s => ({ ...s, id: newId(), itemId: ids.get(s.itemId)! }));
  garage.proposals = garage.proposals.map(p => ({ ...p, id: newId(), vehicleId, itemId: ids.get(p.itemId)! }));
  return { ...garage, readingAt: garage.readingAt ?? now.toISOString() };
}
