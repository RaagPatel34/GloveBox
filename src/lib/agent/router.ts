// The .ts extension lets `npm run eval:router` load this file under plain Node.
import { pacificDate } from "../days.ts";
import { BASELINE_INTERVALS, isItemKind, isOdometerReading, isPlainDate, parseMiles } from "../intervals.ts";
import { toErrandStop, type ErrandStop, type ScheduleItemKind } from "../types.ts";
import type { Chat } from "./chat";

// Nano reads one command-bar input and says what kind it is, pulling out any fields.
// It never changes anything: the route only decides which agent runs next.
//
// The reply is untrusted text. parseRoute keeps only what it can check (a known intent,
// a known item, a plain date, a whole-number odometer) and calls anything else unknown.

export type Route =
  | { intent: "service_log"; item?: ScheduleItemKind; date?: string; odometer?: number }
  | { intent: "odometer"; odometer: number }
  | { intent: "event" }
  // The places to go, in the order they were typed, when the reply names any it can use.
  | { intent: "errand"; stops?: ErrandStop[] }
  | { intent: "unknown" };

const ITEM_LIST = Object.entries(BASELINE_INTERVALS)
  .map(([kind, { label }]) => `${kind} (${label})`)
  .join(", ");

function systemPrompt(today: string): string {
  return [
    "You route messages typed into a car-upkeep app. Reply with one JSON object and nothing else.",
    `Today is ${today}.`,
    "Pick one intent:",
    '- "service_log": the user did upkeep on the car. Add "item" (one of the ids below) if clear,',
    '  "date" as YYYY-MM-DD if they said when, and "odometer" as a whole number if they gave the mileage.',
    '- "odometer": the user is telling you the current odometer reading. Add "odometer" as a whole number.',
    '- "event": something coming up that affects the car, such as a trip or a change in driving.',
    '- "errand": places they want to go, such as gas, a car wash or a shop. Add "stops", in the order they said them:',
    '  {"type":"gas"} for gas, {"type":"wash"} for a car wash, and {"type":"address","name":"Trader Joe\'s"} for any named place.',
    '  Leave out deadlines like "before Friday".',
    '- "unknown": anything else.',
    `Item ids: ${ITEM_LIST}.`,
    'Example: "just got a car wash" -> {"intent":"service_log","item":"wash"}',
  ].join("\n");
}

export async function routeCommand(text: string, chat: Chat, now: Date): Promise<Route> {
  const reply = await chat({
    tier: "nano",
    messages: [
      { role: "system", content: systemPrompt(pacificDate(now)) },
      { role: "user", content: text },
    ],
  });
  return parseRoute(reply.content);
}

// "48,210", "48.2k" or 48210 -> the reading. Anything that is not a valid reading is undefined.
function toOdometer(value: unknown): number | undefined {
  const n = parseMiles(value);
  return isOdometerReading(n) ? n : undefined;
}

// The stops it can check: a gas or car-wash stop, or a place with a name of a sensible length.
function toErrandStops(value: unknown): ErrandStop[] {
  if (!Array.isArray(value)) return [];
  const stops = value.flatMap((stop) => toErrandStop(stop) ?? []);
  return stops.length === value.length ? stops : [];
}

// The JSON object that ends last in the text: the answer comes after any reasoning or
// draft, and stray braces in prose around it are skipped. Undefined if there is none.
function lastJsonObject(text: string): Record<string, unknown> | undefined {
  let best: { end: number; value: Record<string, unknown> } | undefined;
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    const end = matchingBrace(text, start);
    // At the same end, the earlier start is the outer object.
    if (end === -1 || (best && end <= best.end)) continue;
    try {
      const value: unknown = JSON.parse(text.slice(start, end + 1));
      if (typeof value === "object" && value !== null) best = { end, value: value as Record<string, unknown> };
    } catch {
      // Not JSON: reasoning in braces, say.
    }
  }
  return best?.value;
}

// The index of the "}" closing the "{" at `start`, skipping braces inside strings; -1 if none.
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

export function parseRoute(raw: string | null): Route {
  const unknown: Route = { intent: "unknown" };
  if (raw === null) return unknown;

  // Reasoning models may think out loud first, or wrap the JSON in a code fence. Thinking
  // that never closes was cut off, so it has no answer; a lone </think> ends the thinking.
  const text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^[\s\S]*<\/think>/, "");
  const fields = lastJsonObject(text);
  if (fields === undefined) return unknown;

  switch (fields.intent) {
    case "service_log": {
      const route: Route = { intent: "service_log" };
      if (isItemKind(fields.item)) route.item = fields.item;
      if (isPlainDate(fields.date)) route.date = fields.date;
      const odometer = toOdometer(fields.odometer);
      if (odometer !== undefined) route.odometer = odometer;
      return route;
    }
    case "odometer": {
      const odometer = toOdometer(fields.odometer);
      return odometer === undefined ? unknown : { intent: "odometer", odometer };
    }
    case "errand": {
      const stops = toErrandStops(fields.stops);
      return stops.length > 0 ? { intent: "errand", stops } : { intent: "errand" };
    }
    case "event":
      return { intent: "event" };
    default:
      return unknown;
  }
}

// How a route differs from an example's expectation, one line per field. A field the
// expectation leaves out must be absent, so an invented odometer or date is a miss.
// Empty means it matches.
export function checkRoute(actual: Route, expected: Route): string[] {
  const got = actual as Record<string, unknown>;
  const want = expected as Record<string, unknown>;
  const show = (value: unknown) => JSON.stringify(value) ?? "undefined";
  return [...new Set([...Object.keys(want), ...Object.keys(got)])]
    .filter((key) => show(got[key]) !== show(want[key]))
    .map((key) => `${key}: expected ${show(want[key])}, got ${show(got[key])}`);
}
