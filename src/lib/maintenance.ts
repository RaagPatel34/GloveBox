import type { Proposal, ScheduleItem, Vehicle, ServiceEntry } from './types';

export const STORAGE_KEY = 'glovebox.v1';
export type Garage = { version: 1; vehicle: Vehicle; items: ScheduleItem[]; proposals: Proposal[]; services?: ServiceEntry[] };
export type CommandResult = { proposals: Proposal[]; message: string; source: 'sample' | 'nebius'; model?: string };
const DAY = 86_400_000;
export const LABELS: Record<ScheduleItem['kind'], string> = {
  wash: 'Exterior wash', oil: 'Oil change', tire_rotation: 'Tire rotation',
  tire_pressure: 'Tire pressure', wipers: 'Wiper blades', cabin_filter: 'Cabin filter inspection',
  engine_filter: 'Engine filter inspection', brake_check: 'Brake inspection',
};
export function demoGarage(now = new Date()): Garage {
  const date = (days: number) => new Date(now.getTime() + days * DAY).toISOString();
  const vehicle: Vehicle = { id: 'demo-civic', isDemo: true, mpgSource: { kind: 'sample' }, visitorId: 'local-demo', year: 2019, make: 'Honda', model: 'Civic', epaMpg: 32, odometer: 48000, weeklyMiles: 250, home: { label: 'Buena Park City Hall, 6650 Beach Blvd, Buena Park, CA', lat: 33.8675, lng: -117.9981 } };
  const item = (kind: ScheduleItem['kind'], dueAt?: string, dueOdometer?: number): ScheduleItem => ({ id: kind, vehicleId: vehicle.id, kind, dueAt, dueOdometer, status: 'unknown', intervalSource: { kind: 'baseline' } });
  return { version: 1, vehicle, items: [
    { ...item('wash', date(-12)), lastDoneAt: date(-26), intervalDays: 14 },
    item('oil', date(120), 48400),
    item('tire_rotation', undefined, 51500),
    item('tire_pressure', date(18)),
    item('wipers', date(150)),
    item('cabin_filter', date(100)),
    item('engine_filter', undefined, 60000),
    item('brake_check', date(180), 56000),
  ], proposals: [] };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2_000_000; }
function date(value: unknown): boolean { return value === undefined || (typeof value === 'string' && value.length <= 30 && Number.isFinite(Date.parse(value))); }
function target(value: unknown): boolean { return record(value) && date(value.dueAt) && (value.dueOdometer === undefined || number(value.dueOdometer)); }
function text(value: unknown, max = 100): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
export function isGarage(value: unknown): value is Garage {
  if (!record(value) || value.version !== 1 || !record(value.vehicle) || !Array.isArray(value.items) || !Array.isArray(value.proposals)) return false;
  const v = value.vehicle;
  if (!text(v.id) || !text(v.make) || !text(v.model) || !number(v.year) || !number(v.odometer) || !number(v.epaMpg) || v.epaMpg === 0 || !number(v.weeklyMiles) || !record(v.home) || !text(v.home.label)) return false;
  if (value.items.length < 1 || value.items.length > 20 || value.proposals.length > 100) return false;
  if (v.mpgOverride !== undefined && (!number(v.mpgOverride) || v.mpgOverride < 1 || v.mpgOverride > 150)) return false;
  if (v.isDemo !== undefined && typeof v.isDemo !== 'boolean') return false;
  if (v.mpgSource !== undefined && (!record(v.mpgSource) || !['manual', 'epa', 'sample'].includes(String(v.mpgSource.kind)) || (v.mpgSource.url !== undefined && !safeUrl(v.mpgSource.url)))) return false;
  const ids = new Set<string>();
  for (const i of value.items) {
    if (!record(i) || !text(i.id) || ids.has(i.id) || i.vehicleId !== v.id || typeof i.kind !== 'string' || !Object.hasOwn(LABELS, i.kind) || !target(i) || !record(i.intervalSource) || !['baseline', 'manufacturer', 'user', 'nhtsa'].includes(String(i.intervalSource.kind))) return false;
    if ((i.intervalDays !== undefined && (!number(i.intervalDays) || i.intervalDays < 1 || i.intervalDays > 3650)) || (i.intervalMiles !== undefined && (!number(i.intervalMiles) || i.intervalMiles < 1 || i.intervalMiles > 200000))) return false;
    if (!date(i.lastDoneAt) || (i.lastDoneOdometer !== undefined && !number(i.lastDoneOdometer)) || (i.intervalSource.url !== undefined && !safeUrl(i.intervalSource.url)) || (i.intervalSource.note !== undefined && (typeof i.intervalSource.note !== 'string' || i.intervalSource.note.length > 600))) return false;
    ids.add(i.id);
  }
  if (value.services !== undefined && (!Array.isArray(value.services) || value.services.length > 500 || !value.services.every(e => record(e) && text(e.id) && typeof e.itemId === 'string' && ids.has(e.itemId) && text(e.date, 30) && date(e.date) && number(e.odometer) && typeof e.notes === 'string' && e.notes.length <= 500 && text(e.createdAt, 30) && date(e.createdAt)))) return false;
  return value.proposals.every(p => record(p) && text(p.id) && p.vehicleId === v.id && typeof p.itemId === 'string' && ids.has(p.itemId) && target(p.from) && target(p.to) && text(p.reason, 600) && (p.sourceUrl === undefined || safeUrl(p.sourceUrl)) && ['pending', 'applied', 'dismissed'].includes(String(p.state)) && ['sample', 'nano', 'super', 'ultra'].includes(String(p.model)));
}

export function makeProposals(raw: unknown, garage: Garage, model: Proposal['model'], now = new Date()): Proposal[] {
  if (!Array.isArray(raw) || raw.length > 3) throw new Error('Expected at most three suggestions.');
  const seen = new Set<string>();
  return raw.map((entry): Proposal => {
    if (!record(entry) || !text(entry.itemId) || !text(entry.reason, 600) || !Number.isInteger(entry.daysUntilDue) || Number(entry.daysUntilDue) < 0 || Number(entry.daysUntilDue) > 14) throw new Error('Invalid suggestion.');
    const item = garage.items.find(i => i.id === entry.itemId);
    if (!item || !['wash', 'tire_pressure', 'cabin_filter', 'engine_filter'].includes(item.kind) || seen.has(item.id)) throw new Error('Unsupported or duplicate maintenance item.');
    seen.add(item.id);
    // An event can bring a check forward, never postpone an existing deadline.
    const proposed = now.getTime() + Number(entry.daysUntilDue) * DAY;
    const dueAt = new Date(Math.min(proposed, item.dueAt ? Date.parse(item.dueAt) : proposed)).toISOString();
    return { id: crypto.randomUUID(), vehicleId: garage.vehicle.id, itemId: item.id, from: { dueAt: item.dueAt, dueOdometer: item.dueOdometer }, to: { dueAt, dueOdometer: item.dueOdometer }, reason: entry.reason.trim(), model, state: 'pending' };
  }).filter(p => p.to.dueAt !== p.from.dueAt);
}
export function sampleCommand(command: string, garage: Garage, now = new Date()): CommandResult {
  if (!/dirt|dust|camping/i.test(command)) return { proposals: [], source: 'sample', message: 'Sample mode supports the dirt-road example. Try “I drove 300 miles on dirt roads”, or switch to live AI after setup.' };
  const items = garage.items.filter(i => ['cabin_filter', 'engine_filter'].includes(i.kind));
  const proposals = makeProposals(items.map(i => ({ itemId: i.id, daysUntilDue: 2, reason: 'Sample suggestion: after a dusty trip, inspect this filter for visible dirt. This is an inspection reminder, not a diagnosis or a recommendation to replace it. Check your owner’s manual.' })), garage, 'sample', now);
  return { proposals, source: 'sample', message: proposals.length ? 'A dusty drive is a good moment to review your filter checks. Nothing changes until you apply a suggestion.' : 'Those filter checks are already scheduled at least this soon. No changes needed.' };
}
export function addProposals(garage: Garage, proposals: Proposal[]): Garage {
  // Supersede pending advice for the same item so stale cards cannot overwrite it.
  const ids = new Set(proposals.map(p => p.itemId));
  return { ...garage, proposals: [...garage.proposals.filter(p => p.state !== 'pending' || !ids.has(p.itemId)), ...proposals].slice(-100) };
}
export function resolveProposal(garage: Garage, id: string, action: 'applied' | 'dismissed'): Garage {
  const proposal = garage.proposals.find(p => p.id === id);
  if (!proposal || proposal.state !== 'pending') return garage;
  const item = garage.items.find(i => i.id === proposal.itemId);
  if (action === 'applied' && (!item || item.dueAt !== proposal.from.dueAt || item.dueOdometer !== proposal.from.dueOdometer)) throw new Error('The schedule changed. Dismiss this suggestion and ask again.');
  return { ...garage, items: action === 'applied' ? garage.items.map(i => i.id === proposal.itemId ? { ...i, ...proposal.to, reminderOrigin: proposal.model === 'sample' ? 'sample' as const : 'ai' as const } : i) : garage.items, proposals: garage.proposals.map(p => p.id === id ? { ...p, state: action } : p) };
}

export function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1500) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
