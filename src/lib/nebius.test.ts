import { afterEach, describe, expect, it, vi } from "vitest";
import { missingNebiusConfig, nebius, nebiusChat } from "./nebius";

describe("missingNebiusConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("names every variable the given models need that is not set", () => {
    vi.stubEnv("NEBIUS_API_KEY", "");
    vi.stubEnv("NEBIUS_MODEL_NANO", "nvidia/nano");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "");
    expect(missingNebiusConfig(["nano", "super"])).toEqual(["NEBIUS_API_KEY", "NEBIUS_MODEL_SUPER"]);
  });

  it("is empty when the key and those models are set", () => {
    vi.stubEnv("NEBIUS_API_KEY", "key");
    vi.stubEnv("NEBIUS_MODEL_NANO", "nvidia/nano");
    vi.stubEnv("NEBIUS_MODEL_ULTRA", "");
    expect(missingNebiusConfig(["nano"])).toEqual([]);
  });
});


describe("live inference opt-in", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("blocks direct clients and the router adapter even when credentials exist", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "false");
    vi.stubEnv("NEBIUS_API_KEY", "test-not-a-real-key");
    vi.stubEnv("NEBIUS_MODEL_NANO", "nvidia/nano");
    expect(() => nebius()).toThrow(/paused/);
    await expect(nebiusChat()({ tier: "nano", messages: [] })).rejects.toThrow(/paused/);
  });
});
