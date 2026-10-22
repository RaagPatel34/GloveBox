import OpenAI from "openai";
import type { ModelTier } from "./types";

let client: OpenAI | undefined;

// Server-only: never import this from a client component.
// Created lazily so a missing key fails the request, not `next build`.
export function nebius(): OpenAI {
  client ??= new OpenAI({
    baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
    apiKey: process.env.NEBIUS_API_KEY,
  });
  return client;
}

// Nano routes, Super adjusts schedules, Ultra plans trips. See docs/SPEC.md.
export function modelFor(tier: ModelTier): string {
  const id = {
    nano: process.env.NEBIUS_MODEL_NANO,
    super: process.env.NEBIUS_MODEL_SUPER,
    ultra: process.env.NEBIUS_MODEL_ULTRA,
  }[tier];
  if (!id) throw new Error(`NEBIUS_MODEL_${tier.toUpperCase()} is not set`);
  return id;
}
