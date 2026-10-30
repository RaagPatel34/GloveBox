import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { callTools, say, scriptedChat, type ScriptedChat } from "./agent/scripted-chat";
import type { TripServices } from "./agent/trip";
import { describeEffects, runCommand } from "./command";
import { buildDashboard } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";
import { DEMO_ERRAND, DEMO_ERRAND_STOPS, demoTripServices } from "./fixtures/demo-trip";
import { logService, updateOdometer } from "./service-log";
import { inDays, NOW } from "./test-support";
import type { CarSnapshot, Proposal } from "./types";

const VISITOR = "11111111-2222-4333-8444-555555555555";

async function send(
  text: unknown,
  chat: ScriptedChat | null,
  car: CarSnapshot | null = demoCar(NOW, VISITOR, randomUUID),
  now = NOW,
  trip: TripServices | null = null,
  ultra = true,
) {
  const saved: CarSnapshot[] = [];
  const proposals: Proposal[] = [];
  const reply = await runCommand({
    text,
    car,
    chat,
    now,
    trip,
    ultra,
    save: async (next) => {
      saved.push(next);
    },
    saveProposals: async (next) => {
      proposals.push(...next);
    },
  });
  return { reply, saved, proposals, dashboard: saved[0] && buildDashboard(saved[0], NOW) };
}

const route = (json: object) => say(JSON.stringify(json));

describe("runCommand: service logs", () => {
  it("“just got a car wash” resets the wash and its status, and saves the car", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["logService", { item: "wash" }]), say("Done, your wash is reset.")],
    });

    const { reply, saved, dashboard } = await send("just got a car wash", chat);

    expect(saved).toHaveLength(1);
    const wash = saved[0].items.find((i) => i.kind === "wash")!;
    expect(wash.lastDoneAt).toBe(NOW.toISOString());
    expect(wash.dueAt).toBe(inDays(14));
    expect(dashboard.items.find((i) => i.kind === "wash")!.status).toBe("ok");
    expect(dashboard.counts).toEqual({ overdue: 0, due_soon: 1, ok: 7, unknown: 0 });

    expect(reply.model).toBe("super");
    // A due date, not "14 days left": the dashboard reloads a moment later and must agree.
    expect(reply.changes).toEqual(["Exterior wash logged Oct 22 at 48,000 mi. On track, next due Nov 5."]);
  });

  it("“odometer is 48,450” updates the car and every status that depends on it", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "odometer", odometer: 48_450 })],
      super: [callTools(["updateOdometer", { miles: 48_450 }]), say("Updated.")],
    });

    const { reply, saved, dashboard } = await send("odometer is 48,450", chat);

    expect(saved[0].vehicle.odometer).toBe(48_450);
    expect(dashboard.odometerEstimate).toBe(48_450);
    expect(dashboard.items.find((i) => i.kind === "oil")!.status).toBe("overdue");
    expect(reply.model).toBe("super");
    expect(reply.changes).toEqual([
      "Odometer set to 48,450 mi (was about 48,000).",
      "Oil change (synthetic): Due soon → Overdue.",
    ]);
  });

  it("saves the change as soon as it is recorded, without waiting on another model reply", async () => {
    // No closing sentence in the script: asking Super again would fail and lose the wash.
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["logService", { item: "wash" }])],
    });

    const { reply, saved } = await send("just got a car wash", chat);

    expect(saved).toHaveLength(1);
    expect(chat.requests.filter((r) => r.tier === "super")).toHaveLength(1);
    expect(reply.changes).toEqual(["Exterior wash logged Oct 22 at 48,000 mi. On track, next due Nov 5."]);
  });

  it("shows only numbers the tools computed, never the model's own", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "oil" })],
      super: [
        callTools(["logService", { item: "oil", odometer: 47_900 }]),
        say("Oil logged at 99,999 miles. Next change in 12,345 miles on Jan 1."),
      ],
    });

    const { reply } = await send("changed the oil at 47,900", chat);
    const shown = [reply.message, ...reply.changes].join("\n");

    expect(shown).not.toMatch(/99,999|12,345|Jan 1/);
    expect(reply.changes).toEqual(["Oil change (synthetic) logged Oct 22 at 47,900 mi. On track, next due at 55,400 mi."]);
  });

  it("gives Super the current schedule, the user's words and the router's reading", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["getSchedule", {}]), callTools(["logService", { item: "wash" }]), say("Done.")],
    });

    await send("just got a car wash", chat);

    const first = JSON.stringify(chat.requests.find((r) => r.tier === "super")!.messages);
    expect(first).toContain("just got a car wash");
    expect(first).toContain('\\"item\\":\\"wash\\"');
    const schedule = JSON.parse(chat.requests.filter((r) => r.tier === "super")[1].messages.at(-1)!.content as string);
    expect(schedule.odometerEstimate).toBe(48_000);
    expect(schedule.items.find((i: { item: string }) => i.item === "wash").status).toBe("overdue");
  });

  it("tells Super today's date in California, as it tells Nano", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["getSchedule", {}]), say("Done.")],
    });
    // 2026-10-23 04:00 UTC is still Oct 22 in Buena Park.
    await send("got a car wash yesterday", chat, undefined, new Date("2026-10-23T04:00:00.000Z"));

    const [first, second] = chat.requests.filter((r) => r.tier === "super");
    expect(first.messages[0].content).toContain("Today is 2026-10-22.");
    expect(JSON.parse(second.messages.at(-1)!.content as string).today).toBe("2026-10-22");
  });

  it("saves nothing, with a helpful reply, when Super does not log anything", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log" })],
      super: [say("Which item did you service?")],
    });

    const { reply, saved } = await send("did some maintenance", chat);

    expect(saved).toEqual([]);
    expect(reply.model).toBe("super");
    expect(reply.changes).toEqual([]);
    expect(reply.message).toMatch(/oil change|tire rotation/i);
  });

  it.each([
    ["an odometer reading", { intent: "odometer", odometer: 48_450 }, "odometer is 48,450", /odometer is 48,210/],
    ["a named item", { intent: "service_log", item: "oil" }, "changed the oil", /date or mileage/i],
  ])("says what to fix, not “which item”, when Super records nothing for %s", async (_label, routed, text, message) => {
    const chat = scriptedChat({ nano: [route(routed)], super: [say("I could not do that.")] });
    const { reply, saved } = await send(text, chat);
    expect(saved).toEqual([]);
    expect(reply.model).toBe("super");
    expect(reply.message).not.toMatch(/which item/i);
    expect(reply.message).toMatch(message);
  });
});

describe("runCommand: Super can only record what the router read", () => {
  // Nano routes `text` as `routed`; Super makes `calls` in one turn, then stops.
  const attempt = (routed: object, text: string, ...calls: [string, unknown][]) =>
    send(text, scriptedChat({ nano: [route(routed)], super: [callTools(...calls), say("Done.")] }));

  it("logs only the item the router named", async () => {
    const { saved } = await attempt({ intent: "service_log", item: "wash" }, "just got a car wash", ["logService", { item: "oil" }]);
    expect(saved).toEqual([]);
  });

  it("cannot change the odometer on a service log", async () => {
    const { saved } = await attempt({ intent: "service_log", item: "wash" }, "just got a car wash", [
      "updateOdometer",
      { miles: 60_000 },
    ]);
    expect(saved).toEqual([]);
  });

  it("cannot log a service on an odometer reading", async () => {
    const { saved } = await attempt({ intent: "odometer", odometer: 48_450 }, "odometer is 48,450", [
      "logService",
      { item: "wash" },
    ]);
    expect(saved).toEqual([]);
  });

  it("records one change per message", async () => {
    const { saved, reply } = await attempt(
      { intent: "service_log" },
      "did the oil and the wash",
      ["logService", { item: "oil" }],
      ["logService", { item: "wash" }],
    );
    expect(reply.changes).toHaveLength(1);
    expect(saved[0].items.find((i) => i.kind === "wash")!.lastDoneAt).not.toBe(NOW.toISOString());
  });

  it("uses the router's date and mileage when Super leaves them out", async () => {
    const { saved, reply } = await attempt(
      { intent: "service_log", item: "oil", date: "2026-10-21", odometer: 47_900 },
      "changed the oil yesterday at 47,900",
      ["logService", { item: "oil" }],
    );
    const oil = saved[0].items.find((i) => i.kind === "oil")!;
    expect(oil.lastDoneAt?.slice(0, 10)).toBe("2026-10-21");
    expect(oil.lastDoneOdometer).toBe(47_900);
    expect(reply.changes[0]).toMatch(/^Oil change \(synthetic\) logged Oct 21 at 47,900 mi\./);
  });

  it("refuses a date or mileage that contradicts the router's", async () => {
    const routed = { intent: "service_log", item: "oil", date: "2026-10-21", odometer: 47_900 };
    const text = "changed the oil yesterday at 47,900";
    expect((await attempt(routed, text, ["logService", { item: "oil", odometer: 49_999 }])).saved).toEqual([]);
    expect((await attempt(routed, text, ["logService", { item: "oil", date: "2026-10-01" }])).saved).toEqual([]);
  });

  it("refuses a date or mileage the user never gave", async () => {
    const routed = { intent: "service_log", item: "oil" };
    expect((await attempt(routed, "changed the oil", ["logService", { item: "oil", odometer: 47_000 }])).saved).toEqual([]);
    expect((await attempt(routed, "changed the oil", ["logService", { item: "oil", date: "2026-10-01" }])).saved).toEqual([]);
  });

  it("ignores a router mileage that is not in the user's words", async () => {
    const { saved } = await attempt({ intent: "service_log", item: "wash", odometer: 52_000 }, "just got a car wash", [
      "logService",
      { item: "wash" },
    ]);
    expect(saved[0].items.find((i) => i.kind === "wash")!.lastDoneOdometer).toBe(48_000);
    expect(saved[0].vehicle.odometer).toBe(47_750);
  });

  it.each([
    ["a shorthand mileage", "rotated the tires at 48k", { item: "tire_rotation", odometer: 48_000 }, 48],
    ["a date", "changed the oil on 10/15", { item: "oil", date: "2026-10-15" }, 15],
    ["a count of days", "changed the oil 3 days ago", { item: "oil", date: "2026-10-19" }, 3],
    ["a year", "changed the oil in March 2026", { item: "oil", date: "2026-03-15" }, 2026],
  ])("does not take a number from %s as a mileage", async (_label, text, fields, odometer) => {
    const { saved } = await attempt({ intent: "service_log", ...fields }, text, [
      "logService",
      { item: fields.item, odometer },
    ]);
    expect(saved).toEqual([]);
  });

  it("counts “47.5k” as the user typing 47,500", async () => {
    const routed = { intent: "service_log", item: "tire_rotation", odometer: 47_500 };
    const { saved } = await attempt(routed, "rotated the tires at 47.5k", ["logService", { item: "tire_rotation" }]);
    // Not the 48,000 estimate: the router's reading is used.
    expect(saved[0].items.find((i) => i.kind === "tire_rotation")!.lastDoneOdometer).toBe(47_500);
  });

  it("sets only the reading the user typed", async () => {
    const odometer = { intent: "odometer", odometer: 48_450 };
    expect((await attempt(odometer, "odometer is 48,450", ["updateOdometer", { miles: 49_000 }])).saved).toEqual([]);
    expect((await attempt(odometer, "update my odometer", ["updateOdometer", { miles: 48_450 }])).saved).toEqual([]);
  });
});

describe("runCommand: life events", () => {
  const DEMO_EVENT = "camping trip, 300 miles on dirt roads";
  const OIL_REASON = "300 dusty miles would leave the oil within 100 mi of due: change it before you go.";
  const FILTER_REASON = "Dirt roads clog the engine air filter. Check it when you get back.";

  it("“camping trip, 300 miles on dirt roads” proposes changes to the demo car, and changes nothing yet", async () => {
    const car = demoCar(NOW, VISITOR, randomUUID);
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [
        callTools(["getSchedule", {}]),
        callTools(
          ["proposeAdjustment", { item: "oil", newDueOdometer: 48_000, reason: OIL_REASON }],
          ["proposeAdjustment", { item: "engine_filter", newDueOdometer: 48_300, reason: FILTER_REASON }],
        ),
        say("Two suggestions for your trip."),
      ],
    });

    const { reply, saved, proposals } = await send(DEMO_EVENT, chat, car);

    expect(saved).toEqual([]);
    const itemId = (kind: string) => car.items.find((i) => i.kind === kind)!.id;
    expect(proposals).toEqual([
      {
        id: expect.any(String),
        vehicleId: car.vehicle.id,
        itemId: itemId("oil"),
        from: { dueAt: inDays(65), dueOdometer: 48_400 },
        to: { dueAt: inDays(65), dueOdometer: 48_000 },
        reason: OIL_REASON,
        model: "super",
        state: "pending",
      },
      {
        id: expect.any(String),
        vehicleId: car.vehicle.id,
        itemId: itemId("engine_filter"),
        from: { dueOdometer: 49_800 },
        to: { dueOdometer: 48_300 },
        reason: FILTER_REASON,
        model: "super",
        state: "pending",
      },
    ]);
    expect(reply).toMatchObject({ model: "super", changes: [], proposals: 2 });
  });

  it.each<[string, [string, unknown]]>([
    ["log a service", ["logService", { item: "oil" }]],
    ["set the odometer", ["updateOdometer", { miles: 48_300 }]],
  ])("cannot %s on an event: it can only propose", async (_label, call) => {
    const chat = scriptedChat({ nano: [route({ intent: "event" })], super: [callTools(call), say("Done.")] });

    const { reply, saved, proposals } = await send(DEMO_EVENT, chat);

    expect(saved).toEqual([]);
    expect(proposals).toEqual([]);
    expect(reply.changes).toEqual([]);
    const tools = chat.requests.find((r) => r.tier === "super")!.tools!;
    const offered = tools.map((t) => (t.type === "function" ? t.function.name : t.type));
    expect(offered).toEqual(["getSchedule", "proposeAdjustment"]);
  });

  it("is not offered proposeAdjustment for a service log or an odometer reading", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["proposeAdjustment", { item: "wash", newDueOdometer: 48_100, reason: "x" }]), say("Done.")],
    });
    const { saved, proposals } = await send("just got a car wash", chat);
    expect(saved).toEqual([]);
    expect(proposals).toEqual([]);
  });

  it("proposes one change per item per message", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [
        callTools(
          ["proposeAdjustment", { item: "oil", newDueOdometer: 48_000, reason: OIL_REASON }],
          ["proposeAdjustment", { item: "oil", newDueOdometer: 48_100, reason: OIL_REASON }],
        ),
        say("Done."),
      ],
    });
    const { proposals } = await send(DEMO_EVENT, chat);
    expect(proposals.map((p) => p.to.dueOdometer)).toEqual([48_000]);
  });

  it("tells Super why a proposal was refused, so it can fix it", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [
        callTools(["proposeAdjustment", { item: "oil", newDueOdometer: 40_000, reason: OIL_REASON }]),
        callTools(["proposeAdjustment", { item: "oil", newDueOdometer: 48_000, reason: OIL_REASON }]),
        say("Done."),
      ],
    });
    const { proposals } = await send(DEMO_EVENT, chat);
    const refused = JSON.parse(chat.requests.filter((r) => r.tier === "super")[1].messages.at(-1)!.content as string);
    expect(refused.error).toMatch(/48,000/);
    expect(proposals).toHaveLength(1);
  });

  it("tells Super that a life event can only bring a due point sooner, and refuses a later one", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [callTools(["proposeAdjustment", { item: "oil", newDueOdometer: 55_000, reason: OIL_REASON }]), say("Done.")],
    });
    const { proposals } = await send(DEMO_EVENT, chat);

    expect(proposals).toEqual([]);
    const [first, second] = chat.requests.filter((r) => r.tier === "super");
    const tool = first.tools!.find((t) => t.type === "function" && t.function.name === "proposeAdjustment")!;
    expect(tool.type === "function" && tool.function.description).toMatch(/sooner, never later/);
    expect(JSON.parse(second.messages.at(-1)!.content as string).error).toMatch(/sooner, never later/);
  });

  it("shows Super the suggestions still waiting on the user, so it knows a new one replaces them", async () => {
    const car = demoCar(NOW, VISITOR, randomUUID);
    const oil = car.items.find((i) => i.kind === "oil")!;
    const waiting: Proposal = {
      id: "earlier",
      vehicleId: car.vehicle.id,
      itemId: oil.id,
      from: { dueAt: oil.dueAt, dueOdometer: 48_400 },
      to: { dueAt: oil.dueAt, dueOdometer: 48_100 },
      reason: OIL_REASON,
      model: "super",
      state: "pending",
    };
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [callTools(["getSchedule", {}]), say("Nothing new.")],
    });

    await runCommand({
      text: DEMO_EVENT,
      car,
      pending: [waiting],
      chat,
      now: NOW,
      save: async () => {},
      saveProposals: async () => {},
    });

    const schedule = JSON.parse(chat.requests.filter((r) => r.tier === "super")[1].messages.at(-1)!.content as string);
    const items = schedule.items as { item: string; pendingSuggestion: unknown }[];
    expect(items.find((i) => i.item === "oil")!.pendingSuggestion).toEqual({
      dueAt: oil.dueAt,
      dueOdometer: 48_100,
      reason: OIL_REASON,
    });
    expect(items.find((i) => i.item === "wash")!.pendingSuggestion).toBeNull();
    const tool = chat.requests[1].tools!.find((t) => t.type === "function" && t.function.name === "proposeAdjustment")!;
    expect(tool.type === "function" && tool.function.description).toMatch(/replaces/);
  });

  it("keeps the proposals already made when Super's closing reply fails", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [callTools(["proposeAdjustment", { item: "oil", newDueOdometer: 48_000, reason: OIL_REASON }])],
    });
    const { reply, proposals } = await send(DEMO_EVENT, chat);
    expect(proposals).toHaveLength(1);
    expect(reply).toMatchObject({ model: "super", proposals: 1 });
  });

  it("says so when the proposals cannot be saved", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "event" })],
      super: [callTools(["proposeAdjustment", { item: "oil", newDueOdometer: 48_000, reason: OIL_REASON }]), say("Done.")],
    });
    const reply = await runCommand({
      text: DEMO_EVENT,
      car: demoCar(NOW, VISITOR, randomUUID),
      chat,
      now: NOW,
      save: async () => {},
      saveProposals: async () => {
        throw new Error("db down");
      },
    });
    expect(reply.proposals).toBe(0);
    expect(reply.message).toMatch(/could not save/i);
  });

  it("says so, with nothing to apply, when the event changes nothing", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "event" })], super: [say("Nothing to change for that.")] });

    const { reply, proposals } = await send("going to the movies tonight", chat);

    expect(proposals).toEqual([]);
    expect(reply).toMatchObject({ model: "super", changes: [], proposals: 0 });
    expect(reply.message).toMatch(/nothing/i);
  });
});

describe("describeEffects", () => {
  it("describes each change as it was made, not as the car ended up", () => {
    const logged = logService(demoCar(NOW, VISITOR, randomUUID), { kind: "oil", odometer: 47_900 }, NOW);
    if (!logged.ok) throw new Error(logged.error);
    // 55,000 is within 500 mi of the new oil due point, so oil ends up due soon.
    const read = updateOdometer(logged.car, 55_000, NOW);
    if (!read.ok) throw new Error(read.error);

    const lines = describeEffects([logged.effect, read.effect]);
    expect(lines[0]).toBe("Oil change (synthetic) logged Oct 22 at 47,900 mi. On track, next due at 55,400 mi.");
    expect(lines).toContain("Oil change (synthetic): On track → Due soon.");
  });
});

describe("runCommand: errands", () => {
  // Ultra's: the demo errand has three gas stations near home to choose between. With only the
  // EIA average, there are no station prices to weigh.
  const demoSteps = [
    callTools(
      ["findNearby", { type: "gas" }],
      ["findNearby", { type: "wash" }],
      ["geocode", { query: "Trader Joe's, Santa Ana, CA" }],
      ["getGasPrice", {}],
    ),
    callTools(["computeRoute", {}]),
    say("No station prices to compare."),
  ];

  it("“gas, car wash and Trader Joe's” becomes a trip plan from the command bar, with named stops and the fuel priced", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "errand", stops: DEMO_ERRAND_STOPS })],
      ultra: demoSteps,
    });
    const { services } = demoTripServices();

    const { reply, saved, proposals } = await send(DEMO_ERRAND, chat, undefined, NOW, services);

    // A trip plan changes nothing about the car: no log, no cards.
    expect(saved).toEqual([]);
    expect(proposals).toEqual([]);
    expect(reply).toMatchObject({ model: "ultra", changes: [], proposals: 0 });
    expect(reply.message).toBe("Round trip from home: 3 stops, 24.1 mi, $4.17 in fuel.");
    expect(reply.trip?.stops.map((s) => `${s.type}: ${s.name}`)).toEqual([
      "gas: Chevron",
      "wash: Mister Car Wash",
      "address: Trader Joe's",
    ]);
    // 24.1 mi ÷ 34 MPG (the demo car) × $5.883
    expect(reply.trip?.fuelCost).toBeCloseTo(4.17, 3);
  });

  it("finds at least two candidate gas stations on the demo trip toward Santa Ana, so the detour verdict has something to decide", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "errand", stops: DEMO_ERRAND_STOPS })], ultra: demoSteps });
    const { services } = demoTripServices();

    const { reply } = await send(DEMO_ERRAND, chat, undefined, NOW, services);

    expect(reply.trip?.gasCandidates?.length).toBeGreaterThanOrEqual(2);
  });

  it("hands the router's stops to the trip agent as the user's stops, not the raw sentence", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "errand", stops: DEMO_ERRAND_STOPS })],
      ultra: demoSteps,
    });
    const { services } = demoTripServices();

    await send(DEMO_ERRAND, chat, undefined, NOW, services);

    const user = chat.requests.find((r) => r.tier === "ultra")!.messages.at(-1)!;
    expect(JSON.parse(user.content as string)).toEqual({
      stops: [{ type: "gas" }, { type: "wash" }, { type: "address", name: "Trader Joe's, Santa Ana, CA" }],
    });
  });

  it("plans the demo errand on Super, with no detour, when Ultra isn't set up", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "errand", stops: DEMO_ERRAND_STOPS })], super: demoSteps.slice(0, 2) });
    const { services } = demoTripServices();

    const { reply } = await send(DEMO_ERRAND, chat, undefined, NOW, services, false);

    expect(reply).toMatchObject({ model: "super" });
    expect(reply.trip).toMatchObject({ model: "super" });
    expect(reply.trip?.detour).toBeUndefined();
    expect(chat.requests.some((r) => r.tier === "ultra")).toBe(false);
  });

  it("passes on why there is no plan, from Super, when a place can't be found", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "errand", stops: [{ type: "address", name: "Blorfville Mall" }] })],
      super: [callTools(["geocode", { query: "Blorfville Mall" }], ["getGasPrice", {}])],
    });
    const { services } = demoTripServices();

    const { reply, saved } = await send("Blorfville Mall", chat, undefined, NOW, services);

    expect(saved).toEqual([]);
    expect(reply.trip).toBeUndefined();
    expect(reply).toMatchObject({ model: "super", changes: [], proposals: 0 });
    expect(reply.message).toMatch(/couldn't find “Blorfville Mall”/);
  });
});

describe("runCommand: input it cannot act on", () => {
  it("answers input the router cannot place with examples to try, from Nano, without calling Super", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "unknown" })] });
    const { reply, saved } = await send("what's the capital of France", chat);

    expect(saved).toEqual([]);
    expect(reply).toMatchObject({ model: "nano", changes: [] });
    expect(reply.message).toMatch(/car wash/);
    // Life events are something it can do too.
    expect(reply.message).toMatch(/coming up, like “camping trip/);
  });

  it("asks which places to go when an errand names none, without calling Super", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "errand" })] });
    const { reply, saved } = await send("I have some errands", chat, undefined, NOW, demoTripServices().services);
    expect(saved).toEqual([]);
    expect(reply).toMatchObject({ model: "nano", changes: [], proposals: 0 });
    expect(reply.trip).toBeUndefined();
    expect(reply.message).toMatch(/which places/i);
    expect(reply.message).toMatch(/Trader Joe/);
    expect(chat.requests.filter((r) => r.tier === "super")).toHaveLength(0);
  });

  it("says trip planning is not connected, rather than guessing, when Google Maps or EIA is not set up", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "errand", stops: [{ type: "gas" }] })] });
    const { reply, saved } = await send("need gas", chat);
    expect(saved).toEqual([]);
    expect(reply).toMatchObject({ model: "nano", changes: [], proposals: 0 });
    expect(reply.trip).toBeUndefined();
    expect(reply.message).toMatch(/Google Maps and EIA prices.*aren't connected/);
  });

  it("explains, without a crash or a badge, when the AI is not set up", async () => {
    const { reply, saved } = await send("just got a car wash", null);
    expect(saved).toEqual([]);
    expect(reply.model).toBeNull();
    expect(reply.message).toMatch(/not connected/i);
  });

  it("explains when the model cannot be reached", async () => {
    const { reply, saved } = await send("just got a car wash", scriptedChat({}));
    expect(saved).toEqual([]);
    expect(reply.model).toBeNull();
    expect(reply.message).toMatch(/try again/i);
  });

  it("badges the model that last answered when a later call fails", async () => {
    const nanoOnly = scriptedChat({ nano: [route({ intent: "service_log", item: "wash" })] });
    const afterNano = await send("just got a car wash", nanoOnly);
    expect(afterNano.reply).toMatchObject({ model: "nano", changes: [] });
    expect(afterNano.reply.message).toMatch(/try again/i);

    const superCutOff = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["getSchedule", {}])],
    });
    const afterSuper = await send("just got a car wash", superCutOff);
    expect(afterSuper.saved).toEqual([]);
    expect(afterSuper.reply.model).toBe("super");
  });

  it.each([["", ""], ["blank", "   "], ["not text", 42], ["too long", "x".repeat(501)]])(
    "asks for something to do when the input is %s, without calling a model",
    async (_label, text) => {
      const chat = scriptedChat({});
      const { reply } = await send(text, chat);
      expect(chat.requests).toEqual([]);
      expect(reply.model).toBeNull();
    },
  );

  it("takes up to 500 characters, and says so when there are more", async () => {
    const tooLong = await send("x".repeat(501), scriptedChat({}));
    expect(tooLong.reply.message).toMatch(/500 characters or fewer/);

    const chat = scriptedChat({ nano: [route({ intent: "unknown" })] });
    await send("x".repeat(500), chat);
    expect(chat.requests).toHaveLength(1);
  });

  it("asks for a car first when there is none", async () => {
    const chat = scriptedChat({});
    const { reply } = await send("just got a car wash", chat, null);
    expect(chat.requests).toEqual([]);
    expect(reply.message).toMatch(/set up|demo car/i);
  });

  it("says so when the change cannot be saved", async () => {
    const chat = scriptedChat({
      nano: [route({ intent: "service_log", item: "wash" })],
      super: [callTools(["logService", { item: "wash" }]), say("Done.")],
    });
    const reply = await runCommand({
      text: "just got a car wash",
      car: demoCar(NOW, VISITOR, randomUUID),
      chat,
      now: NOW,
      save: async () => {
        throw new Error("db down");
      },
      saveProposals: async () => {},
    });
    expect(reply.changes).toEqual([]);
    expect(reply.message).toMatch(/could not save/i);
  });
});
