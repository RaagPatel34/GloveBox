import { DAY_MS } from "./intervals";
import { safeUrl, type Garage } from "./maintenance";
import type { ScheduleItem, ScheduleItemKind, Vehicle } from "./types";

// Manufacturer service intervals, found by a Tavily web search.
// Plain code reads the numbers out of the search results and checks each one against a
// plausible range. The model never sees them, and a link is only ever the address of the
// result the numbers were read from.

// Wash and tire pressure are not manufacturer schedule items.
export type MfrKind = Exclude<ScheduleItemKind, "wash" | "tire_pressure">;

export type MfrInterval = { kind: MfrKind; intervalMiles?: number; intervalDays?: number; url: string };

export type MfrLookup = {
  // "empty": the search worked but nothing usable was in it.
  status: "ok" | "empty" | "unavailable" | "timeout";
  intervals: MfrInterval[];
};

const TAVILY_URL = "https://api.tavily.com/search";
const LOOKUP_TIMEOUT_MS = 8000;
// A little longer than the server's own wait, so the browser hears its answer.
const CLIENT_TIMEOUT_MS = 12000;

// Forum results are excluded at search time; only official maker sources are accepted below.
const EXCLUDED_DOMAINS = [
  "reddit.com",
  "quora.com",
  "youtube.com",
  "community.cartalk.com",
  "tiktok.com",
  "facebook.com",
  "instagram.com",
  "pinterest.com",
];


// Anything outside these ranges is a template error, a forum guess or a different part, not this item's interval.
const BOUNDS: Record<MfrKind, { miles: [number, number]; days: [number, number] }> = {
  oil: { miles: [3000, 15000], days: [90, 365] },
  tire_rotation: { miles: [3000, 10000], days: [90, 365] },
  cabin_filter: { miles: [10000, 30000], days: [180, 730] },
  engine_filter: { miles: [10000, 45000], days: [365, 1095] },
  brake_check: { miles: [5000, 25000], days: [180, 730] },
  wipers: { miles: [7500, 20000], days: [180, 730] },
};

const KINDS = Object.keys(BOUNDS) as MfrKind[];

function isMfrKind(value: unknown): value is MfrKind {
  return typeof value === "string" && Object.hasOwn(BOUNDS, value);
}

const KEYWORDS: Record<MfrKind, RegExp> = {
  oil: /\b(?:engine oil|oil (?:and|&) (?:oil )?filter|oil\/filter|oil change)\b/i,
  tire_rotation: /\btire rotation\b|\brotate\b[^,.;]{0,25}\btires?\b/i,
  cabin_filter: /\b(?:cabin (?:air )?filter|(?:dust and )?pollen filter|(?:a\/c|air conditioning) filter)\b/i,
  engine_filter: /\b(?:engine air filter|air cleaner element|air filter)\b/i,
  // Not "brake pads": pages about pad wear quote lifetimes, not inspection intervals.
  brake_check: /\bbrake (?:inspection|check)\b|\binspect\b[^,.;]{0,30}\bbrakes?\b/i,
  wipers: /\bwiper(?: blades?)?\b/i,
};

const AMOUNT = String.raw`\d{1,3}(?:,\d{3})+|\d{4,6}`;
// "7,500 miles", "5,000-mile", "7,500 – 10,000 miles" (the lower end is read).
const MILES = new RegExp(String.raw`(${AMOUNT})(?:\s*(?:-|–|—|to)\s*(?:${AMOUNT}))?[\s-]*(?:miles?|mi)\b`, "gi");
const MONTHS = /(\d{1,2})(?:\s*(?:-|–|—|to)\s*\d{1,2})?[\s-]*(?:months?|mos?)\b/gi;
const YEARS = /(\d{1,2})[\s-]*years?\b/gi;
const ANNUAL = /\b(?:annually|once (?:a|per) year)\b/gi;

type Found = { at: number; value: number };

function milesIn(text: string): Found[] {
  return [...text.matchAll(MILES)].map((m) => ({ at: m.index, value: Number(m[1].replaceAll(",", "")) }));
}

function daysIn(text: string): Found[] {
  const found: Found[] = [];
  for (const m of text.matchAll(MONTHS)) found.push({ at: m.index, value: Math.round((Number(m[1]) * 365) / 12) });
  for (const m of text.matchAll(YEARS)) found.push({ at: m.index, value: Number(m[1]) * 365 });
  for (const m of text.matchAll(ANNUAL)) found.push({ at: m.index, value: 365 });
  return found.sort((a, b) => a.at - b.at);
}

// The in-range number written just after the keyword, else the closest one before it ("At 7,500 miles: oil
// change"). A number that follows another item's keyword belongs to that item, not to this one.
function pick(found: Found[], from: number, [min, max]: [number, number], earlierService: boolean, until = Infinity): number | undefined {
  const inRange = found.filter((f) => f.value >= min && f.value <= max);
  const before = earlierService ? undefined : [...inRange].reverse().find((f) => f.at < from);
  return (inRange.find((f) => f.at >= from && f.at < until) ?? before)?.value;
}

// A line that only states a service point ("Every 7,500 miles or 12 months:") heads the items under it.
function isHeading(segment: string): boolean {
  const rest = segment
    .replace(MILES, "")
    .replace(MONTHS, "")
    .replace(YEARS, "")
    .replace(ANNUAL, "")
    .replace(/\b(?:at|every|each|or|and|service|services|interval|maintenance|schedule|first|then|year)\b|[\s:–—,()|/-]/gi, "");
  return rest === "" && (milesIn(segment).length > 0 || daysIn(segment).length > 0);
}

// Chunks are joined with "[...]"; lines, bullets, semicolons and sentences each state one thing.
function chunksOf(content: string): string[][] {
  return content
    .split(/\s*\[\.\.\.\]\s*/)
    .map((chunk) =>
      chunk
        .split(/\n|;|•|(?<=[a-z0-9)])\.\s+/i)
        .flatMap((s) => {
          const colon = s.indexOf(":");
          return colon > 0 && isHeading(s.slice(0, colon)) ? [s.slice(0, colon), s.slice(colon + 1)] : [s];
        })
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    );
}

type SearchResult = { url: string; title: string; content: string; score: number };

function searchResults(body: unknown): SearchResult[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r: unknown): SearchResult[] => {
    const row = (r ?? {}) as Record<string, unknown>;
    if (!safeUrl(row.url) || typeof row.content !== "string") return [];
    return [{ url: row.url, title: typeof row.title === "string" ? row.title : "", content: row.content, score: typeof row.score === "number" ? row.score : 0 }];
  });
}

// Only the maker's own domain can supply an interval labelled Manufacturer schedule.
// Independent guides and dealerships remain useful reading, but are not manufacturer evidence.
function isManufacturer(url: string, make: string): boolean {
  const maker = make.toLowerCase().replace(/[^a-z0-9]/g, "");
  const host = new URL(url).hostname.toLowerCase();
  return maker.length >= 3 && (host === maker + ".com" || host.endsWith("." + maker + ".com"));
}

// A search query is not evidence that a result applies to this car. Require the requested
// year and full model name in the result itself; ambiguous results leave existing intervals alone.
function matchesVehicle(result: SearchResult, vehicle: Pick<Vehicle, "year" | "make" | "model">): boolean {
  const text = decodeURIComponent(result.url) + " " + result.title + " " + result.content;
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const model = vehicle.model.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = words.split(" ");
  const make = vehicle.make.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  const modelWords = model.split(" ");
  // A result can include matching navigation text and another car's schedule. Conflicting
  // years or explicit year/make/model headings make the entire result ambiguous.
  for (let i = 0; i < tokens.length; i++) {
    if (!/^(?:19|20)\d{2}$/.test(tokens[i])) continue;
    if (Number(tokens[i]) !== vehicle.year) return false;
    if (make.every((word, j) => tokens[i + 1 + j] === word) &&
        !modelWords.every((word, j) => tokens[i + 1 + make.length + j] === word)) return false;
  }
  return (" " + words + " ").includes(" " + vehicle.year + " ") && (" " + words + " ").includes(" " + model + " ");
}

function intervalFrom(kind: MfrKind, miles: number | undefined, days: number | undefined, url: string): MfrInterval | null {
  const bounds = BOUNDS[kind];
  const inRange = (value: number | undefined, [min, max]: [number, number]) =>
    value !== undefined && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
  const intervalMiles = inRange(miles, bounds.miles);
  const intervalDays = inRange(days, bounds.days);
  if (intervalMiles === undefined && intervalDays === undefined) return null;
  return {
    kind,
    ...(intervalMiles === undefined ? {} : { intervalMiles }),
    ...(intervalDays === undefined ? {} : { intervalDays }),
    url,
  };
}

// Best-ranked source first; the first source that states an item wins it.
function extractIntervals(results: SearchResult[], vehicle: Pick<Vehicle, "year" | "make" | "model">): MfrInterval[] {
  const ranked = results
    .filter((r) => isManufacturer(r.url, vehicle.make) && matchesVehicle(r, vehicle))
    .sort((a, b) => b.score - a.score);

  const found = new Map<MfrKind, MfrInterval>();
  for (const result of ranked) {
    for (const chunk of chunksOf(result.content)) {
      let heading: { miles: Found[]; days: Found[] } | null = null;
      for (const segment of chunk) {
        if (isHeading(segment)) {
          heading = { miles: milesIn(segment), days: daysIn(segment) };
          continue;
        }
        const ownMiles = milesIn(segment);
        const ownDays = daysIn(segment);
        const inherits = ownMiles.length === 0 && ownDays.length === 0;
        for (const kind of KINDS) {
          if (found.has(kind)) continue;
          // An engine air filter line must not also be read as the cabin filter's.
          const text = kind === "engine_filter" ? segment.replace(new RegExp(KEYWORDS.cabin_filter, "gi"), (m) => " ".repeat(m.length)) : segment;
          const match = KEYWORDS[kind].exec(text);
          if (!match) continue;
          const at = match.index;
          const earlierService = KINDS.some((k) => segment.slice(0, at).search(KEYWORDS[k]) >= 0);
          const end = at + match[0].length;
          const following = KINDS.map((k) => text.slice(end).search(KEYWORDS[k])).filter((i) => i >= 0);
          const until = inherits || following.length === 0 ? Infinity : end + Math.min(...following);
          const miles = inherits ? heading?.miles : ownMiles;
          const days = inherits ? heading?.days : ownDays;
          const from = inherits ? 0 : at;
          const interval = intervalFrom(
            kind,
            pick(miles ?? [], from, BOUNDS[kind].miles, earlierService, until),
            pick(days ?? [], from, BOUNDS[kind].days, earlierService, until),
            result.url,
          );
          if (interval) found.set(kind, interval);
        }
      }
    }
  }
  return KINDS.flatMap((kind) => found.get(kind) ?? []);
}

// Never throws: a missing answer is a lookup with nothing in it, and the caller keeps what it had.
export async function lookupMfrSchedule(
  vehicle: Pick<Vehicle, "year" | "make" | "model">,
  options: { apiKey: string; fetcher?: typeof fetch; timeoutMs?: number },
): Promise<MfrLookup> {
  const { apiKey, fetcher = fetch, timeoutMs = LOOKUP_TIMEOUT_MS } = options;
  try {
    const response = await fetcher(TAVILY_URL, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `${vehicle.year} ${vehicle.make} ${vehicle.model} manufacturer maintenance schedule service intervals oil change tire rotation cabin air filter miles months`,
        // Advanced returns longer, reranked chunks: a schedule table survives intact. 2 credits, once per car.
        search_depth: "advanced",
        chunks_per_source: 3,
        max_results: 6,
        exclude_domains: EXCLUDED_DOMAINS,
        include_answer: false,
        include_raw_content: false,
        auto_parameters: false,
      }),
    });
    if (!response.ok) return { status: "unavailable", intervals: [] };
    const intervals = extractIntervals(searchResults(await response.json()), vehicle);
    return { status: intervals.length > 0 ? "ok" : "empty", intervals };
  } catch (error) {
    return { status: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unavailable", intervals: [] };
  }
}

// The browser's side: asks our own route, which holds the key. Nothing that fails here may block a car being saved.
// Whatever comes back is checked again, since it crossed the network.
export async function requestMfrSchedule(
  vehicle: Pick<Vehicle, "year" | "make" | "model">,
  fetcher: typeof fetch = fetch,
): Promise<MfrInterval[]> {
  try {
    const response = await fetcher("/api/mfr-schedule", {
      method: "POST",
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: vehicle.year, make: vehicle.make, model: vehicle.model }),
    });
    if (!response.ok) return [];
    const intervals = ((await response.json()) as { intervals?: unknown }).intervals;
    return Array.isArray(intervals) ? intervals.flatMap((raw) => cleanInterval(raw, vehicle.make) ?? []) : [];
  } catch {
    return [];
  }
}

function cleanInterval(raw: unknown, make: string): MfrInterval | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  if (!isMfrKind(row.kind) || !safeUrl(row.url) || !isManufacturer(row.url, make)) return null;
  return intervalFrom(row.kind, row.intervalMiles as number | undefined, row.intervalDays as number | undefined, row.url);
}

// An item the owner has not set up: no interval of its own, nothing but the starting placeholder.
function isUnset(item: ScheduleItem): boolean {
  return (
    item.intervalDays === undefined &&
    item.intervalMiles === undefined &&
    (item.intervalSource.kind === "user" || item.intervalSource.kind === "baseline")
  );
}

// Adds the found intervals to items that have none. Never replaces an interval the owner set, and
// leaves the demo car's illustrative dates alone. A due date only appears once a service is on record.
export function applyMfrSchedule(garage: Garage, intervals: MfrInterval[]): Garage {
  if (garage.vehicle.isDemo) return garage;
  const { year, make, model } = garage.vehicle;
  let changed = false;
  const items = garage.items.map((item) => {
    const candidate = intervals.find((i) => i.kind === item.kind);
    const found = candidate && cleanInterval(candidate, make);
    if (!found || !safeUrl(found.url) || !isUnset(item)) return item;
    changed = true;
    const host = new URL(found.url).hostname.replace(/^www\./, "");
    return {
      ...item,
      intervalDays: found.intervalDays,
      intervalMiles: found.intervalMiles,
      dueAt:
        found.intervalDays !== undefined && item.lastDoneAt
          ? new Date(Date.parse(item.lastDoneAt) + found.intervalDays * DAY_MS).toISOString()
          : item.dueAt,
      dueOdometer:
        found.intervalMiles !== undefined && item.lastDoneOdometer !== undefined
          ? item.lastDoneOdometer + found.intervalMiles
          : item.dueOdometer,
      intervalSource: {
        kind: "manufacturer" as const,
        url: found.url,
        note: `Found by web search for a ${year} ${make} ${model}, on ${host}. Check your owner’s manual: your trim and how you drive can change it.`,
      },
    };
  });
  return changed ? { ...garage, items } : garage;
}
