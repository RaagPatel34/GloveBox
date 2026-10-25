import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { callTools, say, scriptedChat } from "./agent/scripted-chat";
import { runCommand } from "./command";
import { demoCar } from "./fixtures/demo-car";
import { NOW } from "./test-support";
import type { Proposal } from "./types";

it("a dirt-road camping event yields Super proposals without changing the car", async () => {
  const car = demoCar(NOW, "11111111-2222-4333-8444-555555555555", randomUUID);
  const before = structuredClone(car);
  const stored: Proposal[] = [];
  const chat = scriptedChat({
    nano: [say(JSON.stringify({ intent: "event" }))],
    super: [callTools(["getSchedule", {}]), callTools(["proposeAdjustment", {
      item: "engine_filter", newDueOdometer: 48_300, reason: "Dirt-road dust can clog the engine air filter.",
    }]), say("Done.")],
  });
  const result = await runCommand({ text: "camping trip, 300 miles on dirt roads", car, chat, now: NOW,
    save: async () => { throw new Error("An event must not save the car"); },
    saveProposals: async (proposals: Proposal[]) => { stored.push(...proposals); },
  });
  expect(result.model).toBe("super");
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ model: "super", state: "pending", to: { dueOdometer: 48_300 }, reason: "Dirt-road dust can clog the engine air filter." });
  expect(stored[0].from).toEqual({ dueOdometer: car.items.find(i => i.kind === "engine_filter")!.dueOdometer });
  expect(car).toEqual(before);
  expect(chat.requests.every(request => request.tier !== "ultra")).toBe(true);
});

it("an event cannot log service or change the odometer, and refuses invalid or later due points", async () => {
  const car = demoCar(NOW, "11111111-2222-4333-8444-555555555555", randomUUID);
  const chat = scriptedChat({
    nano: [say(JSON.stringify({ intent: "event" }))],
    super: [callTools(
      ["logService", { item: "wash" }],
      ["updateOdometer", { miles: 99_000 }],
      ["proposeAdjustment", { item: "engine_filter", newDueOdometer: 999_000, reason: "Dust" }],
      ["proposeAdjustment", { item: "cabin_filter", newDueAt: "2026-02-30", reason: "Dust" }],
      ["proposeAdjustment", { item: "engine_filter", newDueOdometer: -1, reason: "Dust" }],
    ), say("Done.")],
  });
  const saved: unknown[] = [];
  await runCommand({ text: "camping trip, 300 miles on dirt roads", car, chat, now: NOW,
    save: async value => { saved.push(value); }, saveProposals: async value => { saved.push(value); },
  });
  expect(saved).toEqual([]);
});
