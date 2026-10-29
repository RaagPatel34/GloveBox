import { afterEach, describe, expect, it, vi } from "vitest";
import { callTools, say, scriptedChat } from "@/lib/agent/scripted-chat";
import { DEMO_ERRAND, DEMO_ERRAND_STOPS, demoTripServices } from "@/lib/fixtures/demo-trip";
import { demoGarage } from "@/lib/maintenance";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ chat: vi.fn(), completion: vi.fn(), services: vi.fn(), missing: vi.fn(() => [] as string[]) }));
vi.mock("@/lib/nebius", () => ({
  nebiusChat: () => mocks.chat,
  nebius: () => ({ chat: { completions: { create: mocks.completion } } }),
  modelFor: (tier: string) => `test-${tier}`,
  missingNebiusConfig: mocks.missing,
}));
vi.mock("@/lib/trip-services", () => ({ tripServices: mocks.services }));

function request(mode = "live", garage = demoGarage()) {
  return new Request("http://localhost/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ command: DEMO_ERRAND, mode, garage }),
  });
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("browser garage command endpoint", () => {
  it("keeps sample commands and paused AI from calling models or trip providers", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "false");
    expect((await POST(request("sample"))).status).toBe(200);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(mocks.completion).not.toHaveBeenCalled();
    expect(mocks.services).not.toHaveBeenCalled();
  });

  it("asks for clarification when Nano returns a partly invalid errand", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    mocks.chat.mockImplementation(scriptedChat({ nano: [say(JSON.stringify({ intent: "errand", stops: [{ type: "gas" }, { type: "address", name: "" }] }))] }));
    const body = await (await POST(request())).json();
    expect(body.message).toContain("Which places");
    expect(body.trip).toBeUndefined();
    expect(mocks.services).not.toHaveBeenCalled();
    expect(mocks.completion).not.toHaveBeenCalled();
  });

  it("keeps maintenance suggestions working after routing a driving event", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    mocks.chat.mockImplementation(scriptedChat({ nano: [say('{"intent":"event"}')] }));
    mocks.completion.mockResolvedValue({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "proposeMaintenance", arguments: JSON.stringify({ summary: "Review the filters.", proposals: [] }) } }] } }] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ proposals: [], message: "Review the filters.", source: "nebius" });
    expect(mocks.services).not.toHaveBeenCalled();
    expect(mocks.completion).toHaveBeenCalledOnce();
  });

  it("preserves existing live maintenance reviews when only Super is configured", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    mocks.missing.mockReturnValue(["NEBIUS_MODEL_NANO"]);
    mocks.completion.mockResolvedValue({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "proposeMaintenance", arguments: JSON.stringify({ summary: "Review the filters.", proposals: [] }) } }] } }] });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(mocks.completion).toHaveBeenCalledOnce();
  });

  it("rejects unusable browser home coordinates before calling trip providers", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    mocks.chat.mockImplementation(scriptedChat({ nano: [say(JSON.stringify({ intent: "errand", stops: [{ type: "gas" }] }))] }));
    mocks.services.mockReturnValue(demoTripServices().services);
    const garage = demoGarage();
    garage.vehicle.home.lat = 91;
    expect((await POST(request("live", garage))).status).toBe(400);
    expect(mocks.chat).toHaveBeenCalledOnce();
  });

  it("plans an errand from the supplied garage without a cloud car or database", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    vi.stubEnv("DATABASE_URL", "");
    const chat = scriptedChat({
      nano: [say(JSON.stringify({ intent: "errand", stops: DEMO_ERRAND_STOPS }))],
      super: [
        callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["geocode", { query: "Trader Joe's, Santa Ana, CA" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
      ],
    });
    mocks.chat.mockImplementation(chat);
    mocks.services.mockReturnValue(demoTripServices().services);
    mocks.completion.mockResolvedValue({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "proposeMaintenance", arguments: JSON.stringify({ summary: "No maintenance suggestions.", proposals: [] }) } }] } }] });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trip?.stops).toHaveLength(3);
    expect(body.trip?.gasCandidates.length).toBeGreaterThanOrEqual(2);
    expect(body.proposals).toEqual([]);
    expect(body.tier).toBe("super");
    expect(mocks.completion).not.toHaveBeenCalled();
  });
});
