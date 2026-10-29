import OpenAI from "openai";
import type { Chat } from "./agent/chat";
import type { ModelTier } from "./types";

let client: OpenAI | undefined;

// Server-only: never import this from a client component.
// Created lazily so a missing key fails the request, not `next build`.
export function nebius(): OpenAI {
  if (process.env.ENABLE_LIVE_AI !== "true") throw new Error("Live AI is paused.");
  client ??= new OpenAI({
    baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
    apiKey: process.env.NEBIUS_API_KEY,
    timeout: 25000,
    maxRetries: 0,
  });
  return client;
}

const MODEL_ENV: Record<ModelTier, string> = {
  nano: "NEBIUS_MODEL_NANO",
  super: "NEBIUS_MODEL_SUPER",
  ultra: "NEBIUS_MODEL_ULTRA",
};

// Nano routes, Super adjusts schedules, Ultra plans trips. See docs/SPEC.md.
export function modelFor(tier: ModelTier): string {
  const id = process.env[MODEL_ENV[tier]];
  if (!id) throw new Error(`${MODEL_ENV[tier]} is not set`);
  return id;
}

// The env vars still unset for these models. Callers check this first and answer with a
// friendly message, rather than letting a request fail halfway through.
export function missingNebiusConfig(tiers: ModelTier[]): string[] {
  return ["NEBIUS_API_KEY", ...tiers.map((tier) => MODEL_ENV[tier])].filter((name) => !process.env[name]);
}

// Optional. A local stand-in (Qwen on Ollama) thinks before every reply unless told "none",
// which makes it too slow for the 25s timeout. Unset means the provider's default.
export function reasoningEffort(): OpenAI.ReasoningEffort | undefined {
  return (process.env.NEBIUS_REASONING_EFFORT || undefined) as OpenAI.ReasoningEffort | undefined;
}

// The agents' Chat (src/lib/agent/chat.ts), backed by Token Factory.
export function nebiusChat(): Chat {
  return async ({ tier, messages, tools }) => {
    const effort = reasoningEffort();
    const response = await nebius().chat.completions.create({
      model: modelFor(tier),
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
      ...(effort ? { reasoning_effort: effort } : {}),
    });
    const message = response.choices[0]?.message;
    return {
      content: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? []).flatMap((call) =>
        call.type === "function" ? [{ id: call.id, name: call.function.name, arguments: call.function.arguments }] : [],
      ),
    };
  };
}
