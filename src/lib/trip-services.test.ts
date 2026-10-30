import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tripServices } from "./trip-services";

describe("tripServices", () => {
  const on = { ENABLE_MAPS: "true", GOOGLE_MAPS_API_KEY: "maps", EIA_API_KEY: "eia" };

  it("connects Google Maps and EIA only when Maps is switched on and both keys are set", () => {
    expect(tripServices(on)).toMatchObject({
      findPlace: expect.any(Function),
      findPlaces: expect.any(Function),
      route: expect.any(Function),
      gasPrice: expect.any(Function),
    });
    expect(tripServices({ ...on, ENABLE_MAPS: "false" })).toBeNull();
    expect(tripServices({ ...on, ENABLE_MAPS: undefined })).toBeNull();
    expect(tripServices({ ...on, GOOGLE_MAPS_API_KEY: undefined })).toBeNull();
    expect(tripServices({ ...on, EIA_API_KEY: "" })).toBeNull();
  });
});

describe("tripServices gasPrice", () => {
  const tavilyOn = { ENABLE_MAPS: "true", GOOGLE_MAPS_API_KEY: "maps", EIA_API_KEY: "eia", ENABLE_TAVILY: "true", TAVILY_API_KEY: "tvly-key" };
  const chevron = { name: "Chevron", label: "8101 Beach Blvd, Buena Park, CA 90620, USA", lat: 33.84, lng: -117.99 };
  const stationPage = { results: [{
    title: "Chevron in Buena Park, CA - 8101 Beach Blvd | GasBuddy",
    url: "https://www.gasbuddy.com/station/12345",
    content: "Regular $4.899, updated 2 hours ago",
  }] };
  const eiaWeek = (value: string) => ({ response: { data: [{ period: "2026-10-27", value }] } });

  // Answers Tavily and each EIA series with a status and body, recording which were asked.
  const providers = (answers: { tavily?: [number, unknown]; la?: [number, unknown]; ca?: [number, unknown] }) => {
    const asked: string[] = [];
    const fetchImpl = async (url: string) => {
      const which = url.startsWith("https://api.tavily.com/") ? "tavily" : url.includes("Y05LA") ? "la" : "ca";
      asked.push(which);
      const [status, body] = answers[which] ?? [500, {}];
      return new Response(JSON.stringify(body), { status });
    };
    return Object.assign(fetchImpl, { asked });
  };

  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-29T18:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("prices a station from Tavily when Tavily is switched on", async () => {
    const fetchImpl = providers({ tavily: [200, stationPage] });
    await expect(tripServices(tavilyOn, fetchImpl)!.gasPrice({ station: chevron })).resolves.toMatchObject({ price: 4.899, kind: "station" });
    expect(fetchImpl.asked).toEqual(["tavily"]);
  });

  it("falls back to the Los Angeles EIA average when Tavily fails, then to California's", async () => {
    const la = providers({ tavily: [434, {}], la: [200, eiaWeek("4.851")] });
    await expect(tripServices(tavilyOn, la)!.gasPrice({ area: "Buena Park, CA" })).resolves.toMatchObject({ price: 4.851, kind: "eia" });
    expect(la.asked).toEqual(["tavily", "la"]);

    const ca = providers({ tavily: [200, { results: [] }], la: [500, {}], ca: [200, eiaWeek("4.902")] });
    await expect(tripServices(tavilyOn, ca)!.gasPrice({ station: chevron })).resolves.toMatchObject({ price: 4.902, kind: "eia" });
    expect(ca.asked).toEqual(["tavily", "la", "ca"]);
  });

  it("asks only EIA when Tavily is off, has no key, or there is nothing to search for", async () => {
    for (const env of [{ ...tavilyOn, ENABLE_TAVILY: "false" }, { ...tavilyOn, TAVILY_API_KEY: "" }]) {
      const fetchImpl = providers({ la: [200, eiaWeek("4.851")] });
      await expect(tripServices(env, fetchImpl)!.gasPrice({ station: chevron })).resolves.toMatchObject({ kind: "eia" });
      expect(fetchImpl.asked).toEqual(["la"]);
    }
    const fetchImpl = providers({ la: [200, eiaWeek("4.851")] });
    await tripServices(tavilyOn, fetchImpl)!.gasPrice();
    expect(fetchImpl.asked).toEqual(["la"]);
  });
});
