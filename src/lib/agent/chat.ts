import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ModelTier } from "../types";

// The one thing the agents need from a model: send messages (and maybe tools), get one
// reply back. Kept this narrow so the router and the tool loop take it as a parameter:
// production passes the Nebius adapter (src/lib/nebius.ts), tests pass a scripted fake.
// Messages and tools use the OpenAI wire format, since Token Factory speaks it.

export type ToolCall = { id: string; name: string; arguments: string };

export type ChatReply = { content: string | null; toolCalls: ToolCall[] };

export type ChatRequest = {
  tier: ModelTier;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
};

export type Chat = (request: ChatRequest) => Promise<ChatReply>;
