import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ModelTier } from "../types";
import type { Chat } from "./chat";

// The tool-calling loop every agent shares: ask the model, run the tools it calls, hand
// the results back, repeat until it answers in plain text or runs out of turns.
// Tools are registered by name; each agent passes its own set.
//
// A failed call (unknown tool, bad JSON, a tool that throws) goes back to the model as
// { error } so it can correct itself. Only the chat call itself can throw out of here.

export type Tool = {
  name: string;
  description: string;
  // JSON Schema for the arguments object.
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => unknown;
};

export type ToolCallRecord = { name: string; args: unknown; result: unknown };

export type LoopResult = {
  // The model's last plain-text answer, or null if it was cut off.
  text: string | null;
  calls: ToolCallRecord[];
  // False when maxSteps ran out while the model was still calling tools.
  finished: boolean;
};

export const DEFAULT_MAX_STEPS = 6;

export async function runToolLoop(args: {
  chat: Chat;
  tier: ModelTier;
  messages: ChatCompletionMessageParam[];
  tools: Tool[];
  // Model turns, not tool calls: each turn may call several tools.
  maxSteps?: number;
}): Promise<LoopResult> {
  const { chat, tier, tools, maxSteps = DEFAULT_MAX_STEPS } = args;
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const definitions: ChatCompletionTool[] = tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
  const messages = [...args.messages];
  const calls: ToolCallRecord[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const reply = await chat({ tier, messages, tools: definitions });
    if (reply.toolCalls.length === 0) return { text: reply.content, calls, finished: true };

    messages.push({
      role: "assistant",
      content: reply.content,
      tool_calls: reply.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    for (const call of reply.toolCalls) {
      const { args: parsed, result } = await runOne(byName.get(call.name), call.name, call.arguments);
      calls.push({ name: call.name, args: parsed, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { text: null, calls, finished: false };
}

async function runOne(
  tool: Tool | undefined,
  name: string,
  rawArgs: string,
): Promise<{ args: unknown; result: unknown }> {
  if (!tool) return { args: rawArgs, result: { error: `Unknown tool "${name}".` } };

  let args: unknown;
  try {
    // Some models send "" for a tool that takes no arguments.
    args = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
  } catch {
    return { args: rawArgs, result: { error: "The arguments were not valid JSON." } };
  }
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return { args, result: { error: "The arguments must be a JSON object." } };
  }

  try {
    return { args, result: await tool.run(args as Record<string, unknown>) };
  } catch (error) {
    return { args, result: { error: error instanceof Error ? error.message : String(error) } };
  }
}
