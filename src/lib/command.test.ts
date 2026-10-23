import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { callTools, say, scriptedChat, type ScriptedChat } from "./agent/scripted-chat";
import { runCommand } from "./command";
import { buildDashboard } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";
import { inDays, NOW } from "./test-support";
import type { CarSnapshot } from "./types";

const VISITOR = "11111111-2222-4333-8444-555555555555";

async function send(text: unknown, chat: ScriptedChat | null, car: CarSnapshot | null = demoCar(NOW, VISITOR, randomUUID)) {
  const saved: CarSnapshot[] = [];
  const reply = await runCommand({
    text,
    car,
    chat,
    now: NOW,
    save: async (next) => {
      saved.push(next);
    },
  });
  return { reply, saved, dashboard: saved[0] && buildDashboard(saved[0], NOW) };
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
    expect(dashboard.counts).toEqual({ overdue: 0, due_soon: 1, ok: 7 });

    expect(reply.model).toBe("super");
    // A due date, not "14 days left": the dashboard reloads a moment later and must agree.
    expect(reply.changes).toEqual(["Exterior wash logged Oct 22 at 48,000 mi. OK, next due Nov 5."]);
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
    expect(reply.changes).toEqual(["Oil change (synthetic) logged Oct 22 at 47,900 mi. OK, next due at 55,400 mi."]);
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
});

describe("runCommand: input it cannot act on", () => {
  it("answers input the router cannot place with examples to try, from Nano, without calling Super", async () => {
    const chat = scriptedChat({ nano: [route({ intent: "unknown" })] });
    const { reply, saved } = await send("what's the capital of France", chat);

    expect(saved).toEqual([]);
    expect(reply).toMatchObject({ model: "nano", changes: [] });
    expect(reply.message).toMatch(/car wash/);
  });

  it.each([["event", /event/i], ["errand", /trip|errand/i]] as const)(
    "says %s planning is not here yet rather than guessing",
    async (intent, message) => {
      const chat = scriptedChat({ nano: [route({ intent })] });
      const { reply, saved } = await send("camping trip, 300 miles on dirt roads", chat);
      expect(saved).toEqual([]);
      expect(reply.model).toBe("nano");
      expect(reply.message).toMatch(message);
    },
  );

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
    });
    expect(reply.changes).toEqual([]);
    expect(reply.message).toMatch(/could not save/i);
  });
});
