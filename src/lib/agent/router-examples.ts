import type { Route } from "./router";

// The router's fixed check set. Each example is an input, the route it must produce, and
// a sample of the kind of reply Nano gives for it (bare JSON, fenced, with reasoning first).
//
// Two uses:
// - router.test.ts feeds each sample through routeCommand, so the parsing and
//   validation of the model's output is checked on every `npm test`.
// - `npm run eval:router` sends each input to the real Nano and compares what comes
//   back with `expected`. Run it when a key exists and after any prompt change.
//
// `expected` lists only what must match; a date is left out because it depends on today.

export type RouterExample = { input: string; expected: Route; sample: string };

export const ROUTER_EXAMPLES: RouterExample[] = [
  {
    input: "just got a car wash",
    expected: { intent: "service_log", item: "wash" },
    sample: '{"intent":"service_log","item":"wash"}',
  },
  {
    input: "odometer is 48,210",
    expected: { intent: "odometer", odometer: 48_210 },
    sample: '```json\n{"intent": "odometer", "odometer": 48210}\n```',
  },
  {
    input: "changed the oil today at 48,100 miles",
    expected: { intent: "service_log", item: "oil", odometer: 48_100 },
    sample: '{"intent":"service_log","item":"oil","date":"2026-10-22","odometer":48100}',
  },
  {
    input: "rotated the tires",
    expected: { intent: "service_log", item: "tire_rotation" },
    sample: "<think>Tire rotation is a service item.</think>\n{\"intent\":\"service_log\",\"item\":\"tire_rotation\"}",
  },
  {
    input: "put new wiper blades on yesterday",
    expected: { intent: "service_log", item: "wipers" },
    sample: '{"intent":"service_log","item":"wipers","date":"2026-10-21"}',
  },
  {
    input: "checked the tire pressure",
    expected: { intent: "service_log", item: "tire_pressure" },
    sample: 'Here is the classification:\n{"intent":"service_log","item":"tire_pressure"}',
  },
  {
    input: "replaced the cabin air filter",
    expected: { intent: "service_log", item: "cabin_filter" },
    sample: '{"intent":"service_log","item":"cabin_filter"}',
  },
  {
    input: "had the brakes inspected at 47,900",
    expected: { intent: "service_log", item: "brake_check", odometer: 47_900 },
    sample: '{"intent":"service_log","item":"brake_check","odometer":"47,900"}',
  },
  {
    input: "the car reads 51200 now",
    expected: { intent: "odometer", odometer: 51_200 },
    sample: '{"intent":"odometer","odometer":51200}',
  },
  {
    input: "camping trip, 300 miles on dirt roads",
    expected: { intent: "event" },
    sample: '{"intent":"event"}',
  },
  {
    input: "driving to Las Vegas and back next weekend",
    expected: { intent: "event" },
    sample: '{"intent":"event"}',
  },
  {
    input: "gas, car wash and Trader Joe's before Friday",
    expected: { intent: "errand" },
    sample: '{"intent":"errand"}',
  },
  {
    input: "what's the capital of France",
    expected: { intent: "unknown" },
    sample: '{"intent":"unknown"}',
  },
  {
    input: "asdfgh",
    expected: { intent: "unknown" },
    sample: '{"intent":"unknown"}',
  },
];
