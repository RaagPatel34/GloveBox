import { afterEach, describe, expect, it, vi } from "vitest";
import { demoGarage } from "@/lib/maintenance";
import { POST } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Dashboard reasoning preference", () => {
  it("sends the configured reasoning effort for direct maintenance calls and omits it when unset", async () => {
    vi.stubEnv("ENABLE_LIVE_AI", "true");
    vi.stubEnv("NEBIUS_API_KEY", "fixture");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "local-fixture");
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ choices: [{ message: { tool_calls: [{ id: "proposal", type: "function", function: {
        name: "proposeMaintenance", arguments: JSON.stringify({ summary: "No reminder needed.", proposals: [] }),
      } }] } }] });
    }));
    for (const effort of ["none", ""]) {
      vi.stubEnv("NEBIUS_REASONING_EFFORT", effort);
      const response = await POST(new Request("http://localhost/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "I drove on dirt roads", mode: "live", garage: demoGarage() }) }));
      expect(response.status).toBe(200);
    }
    expect(bodies[0]).toMatchObject({ reasoning_effort: "none", model: "local-fixture" });
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });
});
