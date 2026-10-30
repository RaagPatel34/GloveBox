import { afterEach, describe, expect, it, vi } from "vitest";
import { callTools, scriptedChat } from "@/lib/agent/scripted-chat";
import { DEMO_ERRAND_STOPS, DEMO_GAS_PRICE, DEMO_PRICE_SOURCE, demoTripServices } from "@/lib/fixtures/demo-trip";
import { demoGarage } from "@/lib/maintenance";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ chat: vi.fn(), services: vi.fn() }));
vi.mock("@/lib/nebius", () => ({ nebiusChat: () => mocks.chat, missingNebiusConfig: () => [] }));
vi.mock("@/lib/trip-services", () => ({ tripServices: mocks.services }));

const CHEVRON = "7501 Beach Blvd, Buena Park, CA 90620";
const ARCO = "6401 Orangethorpe Ave, Buena Park, CA 90620";
const SHELL = "1500 S Beach Blvd, Anaheim, CA 92804";

// The browser garage stays in the browser, so the Trips panel says when the car is the demo car.
function plan(extra: Record<string, unknown>) {
  const vehicle = demoGarage().vehicle;
  return POST(new Request("http://localhost/api/plan-trip", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ stops: DEMO_ERRAND_STOPS, home: vehicle.home, mpg: vehicle.epaMpg, ...extra }),
  }));
}

async function planErrand(extra: Record<string, unknown>) {
  vi.stubEnv("ENABLE_LIVE_AI", "true");
  // Live-like services: the canned places, and only the weekly average for any price.
  const services = { ...demoTripServices().services, gasPrice: vi.fn(async () => DEMO_GAS_PRICE) };
  mocks.services.mockReturnValue(services);
  mocks.chat.mockImplementation(scriptedChat({
    ultra: [
      callTools(["findNearby", { type: "gas" }], ["findNearby", { type: "wash" }], ["geocode", { query: "Trader Joe's, Santa Ana, CA" }], ["getGasPrice", {}]),
      callTools(["computeRoute", {}]),
      callTools(["getStationPrice", { station: CHEVRON }], ["getStationPrice", { station: ARCO }], ["getStationPrice", { station: SHELL }]),
      callTools(["checkDetour", { station: ARCO }]),
    ],
  }));
  return { reply: await (await plan(extra)).json(), gasPrice: services.gasPrice };
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("trip panel endpoint: station prices for the demo car", () => {
  it("prices the demo car's stations with the labelled demo prices, so Ultra gives a verdict", async () => {
    const { reply } = await planErrand({ demo: true });

    expect(reply.model).toBe("ultra");
    expect(reply.plan?.detour).toMatchObject({ station: "Arco", usual: { station: "Chevron" } });
    expect(reply.plan.detour.price).toMatchObject({ price: 4.899, kind: "station", source: DEMO_PRICE_SOURCE });
  });

  it.each([{}, { demo: false }, { demo: "true" }])("keeps live prices unless the request says demo: true (%o)", async (extra) => {
    const { reply, gasPrice } = await planErrand(extra);

    expect(gasPrice).toHaveBeenCalledWith(expect.objectContaining({ station: expect.objectContaining({ label: ARCO }) }));
    expect(JSON.stringify(reply)).not.toContain(DEMO_PRICE_SOURCE);
    expect(reply.plan?.detour).toBeUndefined();
  });
});
