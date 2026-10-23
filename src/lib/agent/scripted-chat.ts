import type { ModelTier } from "../types";
import type { Chat, ChatReply, ChatRequest } from "./chat";

// A fake model for tests: each tier answers from its own script, in order, and every
// request is recorded so a test can check what was sent. Running out of script throws,
// so a test fails loudly if the code asks a model more often than expected.

export type ScriptedChat = Chat & { requests: ChatRequest[] };

export function scriptedChat(script: Partial<Record<ModelTier, ChatReply[]>>): ScriptedChat {
  const queues = { nano: [...(script.nano ?? [])], super: [...(script.super ?? [])], ultra: [...(script.ultra ?? [])] };
  const requests: ChatRequest[] = [];
  const chat = async (request: ChatRequest) => {
    // A copy, because the caller keeps appending to the same messages array.
    requests.push({ ...request, messages: [...request.messages] });
    const reply = queues[request.tier].shift();
    if (!reply) throw new Error(`The ${request.tier} script ran out`);
    return reply;
  };
  return Object.assign(chat, { requests });
}

export const say = (content: string): ChatReply => ({ content, toolCalls: [] });

let nextCallId = 0;
export const callTools = (...calls: [name: string, args: unknown][]): ChatReply => ({
  content: null,
  toolCalls: calls.map(([name, args]) => ({
    id: `call-${++nextCallId}`,
    name,
    arguments: typeof args === "string" ? args : JSON.stringify(args),
  })),
});
