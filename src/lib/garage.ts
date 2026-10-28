import { LABELS, safeUrl, type Garage } from './maintenance.ts';
import type { ScheduleItem, Vehicle, ServiceEntry } from './types';
export const TIRE_SOURCE = 'https://www.nhtsa.gov/vehicle-safety/tires';
export const HONDA_SOURCE = 'https://owners.honda.com/utility/download?path=%2Fstatic%2Fpdfs%2F2019%2FCivic+Sedan%2F2019_Civic_4D_Maintenance_Minder.pdf';
const DAY = 86400000;
export function bounded(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}
export function createGarage(input: { year: number; make: string; model: string; odometer: number; mpg: number; location: string; epaId?: string; weeklyMiles?: number }, now = new Date()): Garage {
  bounded(input.year, 1984, now.getFullYear() + 1, 'Year');
  if (!Number.isInteger(input.year)) throw new Error('Enter a whole model year.');
  if (!input.make.trim() || !input.model.trim() || input.make.length > 80 || input.model.length > 100 || input.location.length > 100) throw new Error('Enter a make and model, using at most 100 characters.');
  bounded(input.odometer, 0, 2000000, 'Odometer'); bounded(input.mpg, 1, 150, 'MPG');
  if (input.epaId && !/^\d{1,7}$/.test(input.epaId)) throw new Error('Invalid EPA vehicle ID.');
  bounded(input.weeklyMiles ?? 0, 0, 2000, "Weekly miles");
  const id = crypto.randomUUID();
  const vehicle: Vehicle = { id, visitorId: 'local', year: input.year, make: input.make.trim(), model: input.model.trim(), odometer: input.odometer, epaMpg: input.mpg, weeklyMiles: input.weeklyMiles ?? 0, isDemo: false, mpgSource: input.epaId ? { kind: 'epa', url: `https://www.fueleconomy.gov/feg/noframes/${input.epaId}.shtml` } : { kind: 'manual' }, home: { label: input.location.trim() || 'Location not set', lat: 0, lng: 0 } };
  const items: ScheduleItem[] = (Object.keys(LABELS) as ScheduleItem['kind'][]).map(kind => ({ id: kind, kind, vehicleId: id, status: 'unknown', ...(kind === 'tire_pressure' ? { intervalDays: 30 } : {}), intervalSource: kind === 'tire_pressure' ? { kind: 'nhtsa', url: TIRE_SOURCE, note: 'NHTSA recommends monthly cold tire-pressure checks. This reminder uses 30 days; use the pressure on the vehicle placard.' } : { kind: 'user', note: 'No interval assumed. Enter your manual’s guidance or a personal reminder.' } }));
  return { version: 1, vehicle, items, proposals: [], services: [], readingAt: now.toISOString(), plannedTripMiles: 0 };
}
export function updateOdometer(garage: Garage, miles: number, now = new Date()): Garage {
  bounded(miles, garage.vehicle.odometer, 2000000, 'New odometer');
  return { ...garage, readingAt: now.toISOString(), vehicle: { ...garage.vehicle, odometer: miles } };
}
export type ServiceInput = { itemId: string; date: string; odometer: number; notes: string };
export function logService(garage: Garage, input: ServiceInput, now = new Date()): Garage {
  const item = garage.items.find(i => i.id === input.itemId);
  if (!item) throw new Error('Choose a maintenance item.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date) throw new Error('Enter a valid service date.');
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  if (input.date > today || Number(input.date.slice(0,4)) < 1984) throw new Error('Service dates must be in the past or today.');
  bounded(input.odometer, 0, garage.vehicle.odometer, 'Service odometer');
  if (input.notes.length > 500) throw new Error('Notes must be 500 characters or fewer.');
  const existing = garage.services || [];
  if (existing.length >= 500) throw new Error('The local log holds 500 entries. Export your backup before starting a new garage.');
  if (existing.some(e => e.itemId === input.itemId && e.date === input.date && e.odometer === input.odometer)) throw new Error('That service is already recorded.');
  if (existing.some(e => e.date < input.date && e.odometer > input.odometer || e.date > input.date && e.odometer < input.odometer)) throw new Error('The service mileage conflicts with the dates of your existing records.');
  const entry: ServiceEntry = { ...input, notes: input.notes.trim(), id: crypto.randomUUID(), createdAt: now.toISOString() };
  const isLatest = !item.lastDoneAt || input.date >= item.lastDoneAt.slice(0,10);
  if (isLatest && item.lastDoneOdometer !== undefined && input.odometer < item.lastDoneOdometer) throw new Error('This newer service cannot have lower mileage than the previous service.');
  const iso = new Date(`${input.date}T12:00:00`).toISOString();
  const nextItem = { ...item, lastDoneAt: iso, lastDoneOdometer: input.odometer, dueAt: item.intervalDays ? new Date(Date.parse(iso) + item.intervalDays * DAY).toISOString() : undefined, dueOdometer: item.intervalMiles ? input.odometer + item.intervalMiles : undefined, reminderOrigin: 'service' as const };
  return { ...garage, services: [...existing, entry], items: isLatest ? garage.items.map(i => i.id === item.id ? nextItem : i) : garage.items, proposals: isLatest ? garage.proposals.map(p => p.itemId === item.id && p.state === 'pending' ? { ...p, state: 'dismissed' } : p) : garage.proposals };
}
export function setSchedule(garage: Garage, input: { itemId: string; days?: number; miles?: number; url?: string; note: string }): Garage {
  const item = garage.items.find(i => i.id === input.itemId);
  if (!item) throw new Error('Choose a maintenance item.');
  if (input.days !== undefined) { bounded(input.days, 1, 3650, 'Days'); if (!Number.isInteger(input.days)) throw new Error('Days must be whole numbers.'); }
  if (input.miles !== undefined) bounded(input.miles, 1, 200000, 'Miles');
  if (!input.days && !input.miles) throw new Error('Enter an interval in days or miles.');
  if (input.url && !safeUrl(input.url)) throw new Error('Source links must be valid HTTPS URLs without credentials.');
  if (!input.note.trim() || input.note.length > 600) throw new Error('Describe the interval source in 1–600 characters.');
  const next = { ...item, intervalDays: input.days, intervalMiles: input.miles, dueAt: input.days && item.lastDoneAt ? new Date(Date.parse(item.lastDoneAt) + input.days * DAY).toISOString() : undefined, dueOdometer: input.miles && item.lastDoneOdometer !== undefined ? item.lastDoneOdometer + input.miles : undefined, intervalSource: { kind: 'user' as const, url: input.url, note: input.note.trim() }, reminderOrigin: 'user' as const };
  return { ...garage, items: garage.items.map(i => i.id === item.id ? next : i), proposals: garage.proposals.map(p => p.itemId === item.id && p.state === 'pending' ? { ...p, state: 'dismissed' } : p) };
}

export function setMileagePlan(garage: Garage, weeklyMiles: number, plannedTripMiles: number, now = new Date()): Garage {
  bounded(weeklyMiles, 0, 2000, 'Weekly miles');
  bounded(plannedTripMiles, 0, 10000, 'Planned trip miles');
  return { ...garage, readingAt: garage.readingAt ?? now.toISOString(), plannedTripMiles, vehicle: { ...garage.vehicle, weeklyMiles } };
}
