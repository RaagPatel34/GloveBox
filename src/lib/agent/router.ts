// The .ts extension lets `npm run eval:router` load this file under plain Node.
import { BASELINE_INTERVALS, DAY_MS, isItemKind, isOdometerReading, isPlainDate } from "../intervals.ts";
import type { ScheduleItemKind } from "../types";
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
  | { intent: "errand" }
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
    '- "errand": places they want to go, such as gas, a car wash or a shop.',
    '- "unknown": anything else.',
    `Item ids: ${ITEM_LIST}.`,
    'Example: "just got a car wash" -> {"intent":"service_log","item":"wash"}',
  ].join("\n");
}

// The calendar day in California, where GloveBox is used, so "yesterday" means the same to the model and the user.
const pacificDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

// YYYY-MM-DD in California, `daysBack` days before `now`.
export function pacificDate(now: Date, daysBack = 0): string {
  const today = new Date(`${pacificDay.format(now)}T12:00:00.000Z`);
  return new Date(today.getTime() - daysBack * DAY_MS).toISOString().slice(0, 10);
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

// "48,210" or 48210 -> 48210. Anything that is not a valid reading is undefined.
function toOdometer(value: unknown): number | undefined {
  const n = typeof value === "string" && /^[\d,]+$/.test(value.trim()) ? Number(value.replace(/,/g, "")) : value;
  return isOdometerReading(n) ? n : undefined;
}

export function parseRoute(raw: string | null): Route {
  const unknown: Route = { intent: "unknown" };
  if (raw === null) return unknown;

  // Reasoning models may think out loud first, or wrap the JSON in a code fence.
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) return unknown;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return unknown;
  }
  if (typeof parsed !== "object" || parsed === null) return unknown;
  const fields = parsed as Record<string, unknown>;

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
    case "event":
    case "errand":
      return { intent: fields.intent };
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
    .filter((key) => got[key] !== want[key])
    .map((key) => `${key}: expected ${show(want[key])}, got ${show(got[key])}`);
}
