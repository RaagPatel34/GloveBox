import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mfr-schedule/route";
import { requestMfrSchedule } from "./mfr-schedule";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SCHEDULE_SOURCE = "https://owners.honda.com/2019-civic/schedule/";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("https://glovebox.test/api/mfr-schedule", { method: "POST", headers, body: JSON.stringify(body) }));
const civic = { year: 2019, make: "Honda", model: "Civic" };

function enableTavily() {
  vi.stubEnv("ENABLE_TAVILY", "true");
  vi.stubEnv("TAVILY_API_KEY", "test-only");
}

describe("POST /api/mfr-schedule", () => {
  it("makes no provider call when disabled, even if a key exists", async () => {
    vi.stubEnv("ENABLE_TAVILY", "false");
    vi.stubEnv("TAVILY_API_KEY", "test-only");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect((await post(civic)).status).toBe(503);
    expect(network).not.toHaveBeenCalled();
  });

  it("refuses other websites and malformed cars before searching", async () => {
    enableTavily();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect((await post(civic, { Origin: "https://other.test" })).status).toBe(403);
    for (const bad of [{}, { ...civic, year: "2019" }, { ...civic, year: 1900 }, { ...civic, make: "" }, { ...civic, model: "x".repeat(101) }]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("answers with the intervals found", async () => {
    enableTavily();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ results: [{ url: SCHEDULE_SOURCE, content: "Oil and filter change: every 7,500 miles or 12 months." }] })),
    );
    const response = await post(civic);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      intervals: [{ kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE }],
    });
  });

  it("answers 503 with no intervals when Tavily fails", async () => {
    enableTavily();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const response = await post(civic);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ intervals: [] });
  });
});

describe("requestMfrSchedule (the browser's side)", () => {
  const reply = (status: number, body: unknown) => async () => Response.json(body, { status });

  it("returns the intervals the server found", async () => {
    const intervals = [{ kind: "oil", intervalMiles: 7500, url: SCHEDULE_SOURCE }];
    expect(await requestMfrSchedule(civic, reply(200, { status: "ok", intervals }))).toEqual(intervals);
  });

  it("returns nothing, never throws, when the server or network fails", async () => {
    expect(await requestMfrSchedule(civic, reply(503, { intervals: [] }))).toEqual([]);
    expect(
      await requestMfrSchedule(civic, async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toEqual([]);
    expect(await requestMfrSchedule(civic, async () => new Response("not json"))).toEqual([]);
  });

  it("keeps only intervals that are still plausible and linkable", async () => {
    const good = { kind: "oil", intervalMiles: 7500, url: SCHEDULE_SOURCE };
    const intervals = [
      good,
      { kind: "oil", intervalMiles: 150000, url: SCHEDULE_SOURCE },
      { kind: "tire_rotation", intervalMiles: 7500, url: "http://insecure.example/x" },
      { kind: "wash", intervalDays: 14, url: SCHEDULE_SOURCE },
      { kind: "brake_check" },
      "nonsense",
    ];
    expect(await requestMfrSchedule(civic, reply(200, { status: "ok", intervals }))).toEqual([good]);
  });
});

describe("every answer from /api/mfr-schedule", () => {
  it("is marked no-store, errors included", async () => {
    vi.stubEnv("ENABLE_TAVILY", "false");
    expect((await post(civic)).headers.get("Cache-Control")).toBe("no-store");
    enableTavily();
    expect((await post({})).headers.get("Cache-Control")).toBe("no-store");
    expect((await post(civic, { Origin: "https://other.test" })).headers.get("Cache-Control")).toBe("no-store");
  });
});
