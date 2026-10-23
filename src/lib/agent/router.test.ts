import { describe, expect, it } from "vitest";
import { BASELINE_INTERVALS } from "../intervals";
import { NOW } from "../test-support";
import { checkRouterExample, expectedRoute, ROUTER_EXAMPLES } from "./router-examples";
import { checkRoute, parseRoute, routeCommand } from "./router";
import { say, scriptedChat } from "./scripted-chat";

describe("routeCommand on the fixed example set", () => {
  it("covers every intent", () => {
    const intents = new Set(ROUTER_EXAMPLES.map((e) => e.expected.intent));
    expect([...intents].sort()).toEqual(["errand", "event", "odometer", "service_log", "unknown"]);
  });

  // The same check `npm run eval:router` runs against the real Nano, here with the sample reply.
  it.each(ROUTER_EXAMPLES)("routes $input", async (example) => {
    const chat = scriptedChat({ nano: [say(example.sample)] });
    const { problems } = await checkRouterExample(example, chat, NOW);
    expect(problems).toEqual([]);
  });

  it("expects dates as the calendar day in California", () => {
    const byInput = Object.fromEntries(ROUTER_EXAMPLES.map((e) => [e.input, e]));
    // 2026-10-23 04:00 UTC is still Oct 22 in Buena Park.
    const evening = new Date("2026-10-23T04:00:00.000Z");
    expect(expectedRoute(byInput["changed the oil today at 48,100 miles"], evening)).toEqual({
      intent: "service_log",
      item: "oil",
      date: "2026-10-22",
      odometer: 48_100,
    });
    expect(expectedRoute(byInput["put new wiper blades on yesterday"], evening)).toEqual({
      intent: "service_log",
      item: "wipers",
      date: "2026-10-21",
    });
  });

  it("misses a reply that invents a field the input never gave", async () => {
    const [wash] = ROUTER_EXAMPLES;
    const chat = scriptedChat({ nano: [say('{"intent":"service_log","item":"wash","odometer":48000}')] });
    const { problems } = await checkRouterExample(wash, chat, NOW);
    expect(problems).toEqual(["odometer: expected undefined, got 48000"]);
  });
});

describe("routeCommand", () => {
  it("asks Nano, without tools, with the input and today's date in California", async () => {
    const chat = scriptedChat({ nano: [say('{"intent":"unknown"}')] });
    // 2026-10-23 04:00 UTC is still Oct 22 in Buena Park.
    await routeCommand("just got a car wash", chat, new Date("2026-10-23T04:00:00.000Z"));

    const [request] = chat.requests;
    expect(request.tier).toBe("nano");
    expect(request.tools).toBeUndefined();
    expect(request.messages.at(-1)).toEqual({ role: "user", content: "just got a car wash" });
    expect(JSON.stringify(request.messages)).toContain("2026-10-22");
  });

  it("tells Nano every schedule item it may name", async () => {
    const chat = scriptedChat({ nano: [say('{"intent":"unknown"}')] });
    await routeCommand("hi", chat, NOW);
    const prompt = JSON.stringify(chat.requests[0].messages[0]);
    for (const kind of Object.keys(BASELINE_INTERVALS)) expect(prompt).toContain(kind);
  });
});

describe("parseRoute", () => {
  it.each([
    ["no reply at all", null],
    ["prose with no JSON", "I think this is a service log."],
    ["broken JSON", '{"intent": "service_log", '],
    ["an intent it does not know", '{"intent":"chitchat"}'],
    ["an odometer correction with no number", '{"intent":"odometer"}'],
    ["an odometer that is not a whole number of miles", '{"intent":"odometer","odometer":-40}'],
  ])("reads %s as unknown", (_label, raw) => {
    expect(parseRoute(raw)).toEqual({ intent: "unknown" });
  });

  it("reads a reply cut off mid-thought as unknown, even if the thinking holds JSON", () => {
    expect(parseRoute('<think>Maybe {"intent":"event"}? Or')).toEqual({ intent: "unknown" });
  });

  it.each([
    ["braces in untagged reasoning before it", 'The user means {wash}. {"intent":"service_log","item":"wash"}'],
    ["braces in a closed think block before it", '<think>{maybe} {"intent":"event"}</think>{"intent":"service_log","item":"wash"}'],
    ["thinking with only a closing tag before it", 'it is {wash}</think>\n{"intent":"service_log","item":"wash"}'],
    ["an earlier draft object", '{"intent":"event"}\nNo, better:\n{"intent":"service_log","item":"wash"}'],
    ["a note in braces after it", '{"intent":"service_log","item":"wash"} {note: wash only}'],
    ["a code fence and a brace inside a string", '```json\n{"intent":"service_log","item":"wash","why":"}"}\n```'],
  ])("finds the route among %s", (_label, raw) => {
    expect(parseRoute(raw)).toEqual({ intent: "service_log", item: "wash" });
  });

  it("keeps a service log but drops fields it cannot trust", () => {
    expect(parseRoute('{"intent":"service_log","item":"spark_plugs","date":"yesterday","odometer":"lots"}')).toEqual({
      intent: "service_log",
    });
  });

  it("keeps a plain date and a whole-number odometer, commas allowed", () => {
    expect(parseRoute('{"intent":"service_log","item":"oil","date":"2026-10-20","odometer":"48,100"}')).toEqual({
      intent: "service_log",
      item: "oil",
      date: "2026-10-20",
      odometer: 48_100,
    });
  });
});

describe("checkRoute", () => {
  it("lists each field that does not match, including fields the example says are absent", () => {
    expect(checkRoute({ intent: "service_log", item: "oil" }, { intent: "service_log", item: "oil" })).toEqual([]);
    expect(checkRoute({ intent: "service_log", item: "wash", odometer: 48_000 }, { intent: "service_log", item: "wash" })).toEqual([
      "odometer: expected undefined, got 48000",
    ]);
    expect(checkRoute({ intent: "service_log", item: "oil", date: "2026-10-22" }, { intent: "service_log", item: "oil" })).toEqual([
      'date: expected undefined, got "2026-10-22"',
    ]);
    expect(checkRoute({ intent: "service_log", item: "oil" }, { intent: "service_log", item: "wash" })).toEqual([
      'item: expected "wash", got "oil"',
    ]);
    expect(checkRoute({ intent: "event" }, { intent: "odometer", odometer: 48_210 })).toEqual([
      'intent: expected "odometer", got "event"',
      "odometer: expected 48210, got undefined",
    ]);
  });
});
