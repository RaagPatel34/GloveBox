import { describe, expect, it } from "vitest";
import { runToolLoop, type Tool } from "./loop";
import { callTools, say, scriptedChat } from "./scripted-chat";

const add: Tool = {
  name: "add",
  description: "Adds two numbers.",
  parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
  run: (args) => ({ sum: (args.a as number) + (args.b as number) }),
};

const user = [{ role: "user" as const, content: "What is 2 + 3?" }];

describe("runToolLoop", () => {
  it("runs the tool the model asks for, hands back the result, and returns the model's answer", async () => {
    const chat = scriptedChat({ super: [callTools(["add", { a: 2, b: 3 }]), say("It is five.")] });

    const result = await runToolLoop({ chat, tier: "super", messages: user, tools: [add] });

    expect(result).toEqual({
      text: "It is five.",
      calls: [{ name: "add", args: { a: 2, b: 3 }, result: { sum: 5 } }],
      finished: true,
    });
    const lastSent = chat.requests[1].messages;
    expect(lastSent.at(-1)).toMatchObject({ role: "tool", content: JSON.stringify({ sum: 5 }) });
  });

  it("offers the registered tools to the model by name, in the OpenAI function format", async () => {
    const chat = scriptedChat({ super: [say("No tools needed.")] });
    await runToolLoop({ chat, tier: "super", messages: user, tools: [add] });

    expect(chat.requests[0].tier).toBe("super");
    expect(chat.requests[0].tools).toEqual([
      { type: "function", function: { name: "add", description: add.description, parameters: add.parameters } },
    ]);
  });

  it("runs several calls from one turn in order", async () => {
    const chat = scriptedChat({
      super: [callTools(["add", { a: 1, b: 1 }], ["add", { a: 2, b: 2 }]), say("Done.")],
    });
    const result = await runToolLoop({ chat, tier: "super", messages: user, tools: [add] });
    expect(result.calls.map((c) => c.result)).toEqual([{ sum: 2 }, { sum: 4 }]);
  });

  const throwing: Tool = {
    ...add,
    run: () => {
      throw new Error("boom");
    },
  };

  it.each([
    ["an unknown tool", add, callTools(["subtract", { a: 1, b: 1 }]), /unknown tool/i],
    ["arguments that are not JSON", add, callTools(["add", "{a: 1"]), /json/i],
    ["a tool that throws", throwing, callTools(["add", { a: 1, b: 1 }]), /boom/],
  ])("tells the model about %s instead of crashing, and lets it carry on", async (_label, tool, reply, message) => {
    const tools = [tool];
    const chat = scriptedChat({ super: [reply, say("Sorry.")] });

    const result = await runToolLoop({ chat, tier: "super", messages: user, tools });

    expect(result.text).toBe("Sorry.");
    const toolMessage = chat.requests[1].messages.at(-1)!;
    expect(toolMessage.role).toBe("tool");
    expect(JSON.parse(toolMessage.content as string).error).toMatch(message);
  });

  it("sends a tool that returns nothing back as null, so the tool message is still valid", async () => {
    const silent: Tool = { ...add, run: () => undefined };
    const chat = scriptedChat({ super: [callTools(["add", { a: 1, b: 1 }]), say("Done.")] });

    await runToolLoop({ chat, tier: "super", messages: user, tools: [silent] });

    expect(chat.requests[1].messages.at(-1)).toMatchObject({ role: "tool", content: "null" });
  });

  it("stops without asking the model again once the caller's stop condition holds", async () => {
    const chat = scriptedChat({ super: [callTools(["add", { a: 2, b: 3 }]), say("It is five.")] });

    const result = await runToolLoop({
      chat,
      tier: "super",
      messages: user,
      tools: [add],
      stopWhen: (calls) => calls.some((c) => c.name === "add"),
    });

    expect(chat.requests).toHaveLength(1);
    expect(result).toEqual({
      text: null,
      calls: [{ name: "add", args: { a: 2, b: 3 }, result: { sum: 5 } }],
      finished: true,
    });
  });

  it("is bounded: a model that never stops calling tools is cut off after maxSteps turns", async () => {
    const forever = Array.from({ length: 10 }, () => callTools(["add", { a: 1, b: 1 }]));
    const chat = scriptedChat({ super: forever });

    const result = await runToolLoop({ chat, tier: "super", messages: user, tools: [add], maxSteps: 3 });

    expect(chat.requests).toHaveLength(3);
    expect(result.finished).toBe(false);
    expect(result.text).toBeNull();
    expect(result.calls).toHaveLength(3);
  });

  it("does not change the messages it was given", async () => {
    const messages = [...user];
    const chat = scriptedChat({ super: [callTools(["add", { a: 2, b: 3 }]), say("Five.")] });
    await runToolLoop({ chat, tier: "super", messages, tools: [add] });
    expect(messages).toEqual(user);
  });
});
