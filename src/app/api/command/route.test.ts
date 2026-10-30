import { afterEach, describe, expect, it, vi } from "vitest";
import { callTools, say, scriptedChat } from "@/lib/agent/scripted-chat";
import { DEMO_ERRAND, DEMO_ERRAND_STOPS, DEMO_GAS_PRICE, DEMO_PRICE_SOURCE, demoTripServices } from "@/lib/fixtures/demo-trip";
import { demoGarage } from "@/lib/maintenance";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ chat: vi.fn(), completion: vi.fn(), services: vi.fn(), missing: vi.fn(() => [] as string[]) }));
vi.mock("@/lib/nebius", () => ({
  reasoningEffort: () => undefined,
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

  it("plans a gas errand on Super, with no detour, when Ultra isn't set up", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    mocks.missing.mockImplementation((tiers: string[] = []) => (tiers.includes("ultra") ? ["NEBIUS_MODEL_ULTRA"] : []));
    const chat = scriptedChat({
      nano: [say(JSON.stringify({ intent: "errand", stops: DEMO_ERRAND_STOPS }))],
      super: [
        callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["geocode", { query: "Trader Joe's, Santa Ana, CA" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
      ],
    });
    mocks.chat.mockImplementation(chat);
    mocks.services.mockReturnValue(demoTripServices().services);

    const body = await (await POST(request())).json();

    expect(body.tier).toBe("super");
    expect(body.trip?.stops).toHaveLength(3);
    expect(body.trip?.detour).toBeUndefined();
    expect(chat.requests.map((r) => r.tier)).toEqual(["nano", "super", "super"]);
  });

  it("plans an errand from the supplied garage without a cloud car or database", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "test");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
    vi.stubEnv("DATABASE_URL", "");
    const chat = scriptedChat({
      nano: [say(JSON.stringify({ intent: "errand", stops: DEMO_ERRAND_STOPS }))],
      // Three gas stations near home: Ultra plans it.
      ultra: [
        callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["geocode", { query: "Trader Joe's, Santa Ana, CA" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
        say("No station prices to compare."),
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
    expect(body.tier).toBe("ultra");
    expect(mocks.completion).not.toHaveBeenCalled();
  });

  // The demo car's errand reaches a verdict in the running app (#15, AC5); a real car's never
  // sees a demo price.
  describe("station prices for the demo car", () => {
    const CHEVRON = "7501 Beach Blvd, Buena Park, CA 90620";
    const ARCO = "6401 Orangethorpe Ave, Buena Park, CA 90620";
    const SHELL = "1500 S Beach Blvd, Anaheim, CA 92804";
    const errand = () => scriptedChat({
      nano: [say(JSON.stringify({ intent: "errand", stops: DEMO_ERRAND_STOPS }))],
      ultra: [
        callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["geocode", { query: "Trader Joe's, Santa Ana, CA" }], ["getGasPrice", {}]),
        callTools(["computeRoute", {}]),
        callTools(["getStationPrice", { station: CHEVRON }], ["getStationPrice", { station: ARCO }], ["getStationPrice", { station: SHELL }]),
        callTools(["checkDetour", { station: ARCO }]),
      ],
    });
    // Live-like services: the canned places, and only the weekly average for any price.
    const liveServices = () => ({ ...demoTripServices().services, gasPrice: vi.fn(async () => DEMO_GAS_PRICE) });

    async function planErrand(garage: ReturnType<typeof demoGarage>) {
      vi.stubEnv("ENABLE_LIVE_AI", "true");
      vi.stubEnv("NEBIUS_API_KEY", "test");
      vi.stubEnv("NEBIUS_MODEL_SUPER", "test-super");
      const services = liveServices();
      mocks.chat.mockImplementation(errand());
      mocks.services.mockReturnValue(services);
      return { body: await (await POST(request("live", garage))).json(), gasPrice: services.gasPrice };
    }

    it("prices the demo car's stations with the labelled demo prices, so Ultra gives a verdict", async () => {
      const { body } = await planErrand(demoGarage());

      expect(body.tier).toBe("ultra");
      expect(body.trip?.detour).toMatchObject({ station: "Arco", usual: { station: "Chevron" } });
      expect(body.trip.detour.price).toMatchObject({ price: 4.899, kind: "station", source: DEMO_PRICE_SOURCE });
      expect(body.trip.detour.usual.price).toMatchObject({ price: 5.199, source: DEMO_PRICE_SOURCE });
    });

    it("keeps a real car on live prices", async () => {
      const garage = demoGarage();
      garage.vehicle.isDemo = false;

      const { body, gasPrice } = await planErrand(garage);

      expect(gasPrice).toHaveBeenCalledWith(expect.objectContaining({ station: expect.objectContaining({ label: ARCO }) }));
      expect(JSON.stringify(body)).not.toContain(DEMO_PRICE_SOURCE);
      expect(body.trip?.detour).toBeUndefined();
    });
  });
});
