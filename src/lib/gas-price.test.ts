import { describe, expect, it } from "vitest";
import { fetchTavilyPrice, parseTavilyPrice } from "./gas-price";

const now = new Date("2026-10-29T18:00:00Z");
const chevron = { name: "Chevron", label: "8101 Beach Blvd, Buena Park, CA 90620, USA", lat: 33.84, lng: -117.99 };
const result = (row: Record<string, unknown>) => ({ results: [{ title: "", url: "https://www.gasbuddy.com/gasprices/california/buena-park", content: "", score: 0.8, ...row }] });

describe("parseTavilyPrice", () => {
  it("reads a dated price on the asked-for station's page as a station quote", () => {
    const body = result({
      title: "Chevron in Buena Park, CA - 8101 Beach Blvd | GasBuddy",
      url: "https://www.gasbuddy.com/station/12345",
      content: "Chevron 8101 Beach Blvd Buena Park. Regular $4.899 Midgrade $5.099 Premium $5.299",
      published_date: "2026-10-29T15:30:00Z",
    });
    expect(parseTavilyPrice(body, { station: chevron }, now)).toEqual({
      price: 4.899,
      asOf: "2026-10-29T15:30:00.000Z",
      source: "https://www.gasbuddy.com/station/12345",
      kind: "station",
      label: "Chevron, 8101 Beach Blvd",
      stale: false,
    });
  });

  it("skips an undated price and reads an area figure dated by a relative age", () => {
    const body = { results: [
      { title: "Gas prices in Buena Park", url: "https://example.com/undated", content: "Regular $3.199 in Buena Park", score: 0.9 },
      { title: "Buena Park Gas Prices", url: "https://www.gasbuddy.com/gasprices/california/buena-park", content: "Lowest regular $4.659, updated 3 hours ago", score: 0.8 },
    ] };
    expect(parseTavilyPrice(body, { area: "Buena Park, CA" }, now)).toEqual({
      price: 4.659,
      asOf: "2026-10-29T15:00:00.000Z",
      source: "https://www.gasbuddy.com/gasprices/california/buena-park",
      kind: "area",
      label: "Regular gasoline reported around Buena Park, CA",
      stale: false,
    });
  });

  it("finds nothing when every price is undated, out of range or older than a week", () => {
    const body = { results: [
      { url: "https://example.com/a", content: "Regular $4.10", published_date: null },
      { url: "https://example.com/b", content: "Regular $1.99 as of October 28, 2026" },
      { url: "https://example.com/c", content: "Regular $4.50, 8 days ago" },
      { url: "https://example.com/d", content: "Regular $4.50", published_date: "2026-10-20T00:00:00Z" },
      { url: "http://example.com/e", content: "Regular $4.50 updated 1 hour ago" },
    ] };
    expect(() => parseTavilyPrice(body, { area: "Buena Park, CA" }, now)).toThrow();
  });

  it("calls a price for a different station an area figure, not the asked-for station's", () => {
    const body = result({
      title: "ARCO in Buena Park, CA - 6000 Orangethorpe Ave | GasBuddy",
      url: "https://www.gasbuddy.com/station/999",
      content: "ARCO 6000 Orangethorpe Ave. Regular $4.299, 20 minutes ago. Nearby: Chevron.",
    });
    expect(parseTavilyPrice(body, { station: chevron }, now)).toMatchObject({
      price: 4.299, asOf: "2026-10-29T17:40:00.000Z", kind: "area", label: "Regular gasoline reported around Buena Park, CA",
    });
  });

  it("dates a price by an explicit 'as of' date", () => {
    const body = result({ content: "Average regular $4.719 as of Oct 27, 2026 in Orange County" });
    expect(parseTavilyPrice(body, { area: "Orange County, CA" }, now)).toMatchObject({ price: 4.719, asOf: "2026-10-27T00:00:00.000Z", kind: "area" });
  });
});

describe("fetchTavilyPrice", () => {
  const stationPage = result({
    title: "Chevron in Buena Park, CA - 8101 Beach Blvd | GasBuddy",
    url: "https://www.gasbuddy.com/station/12345",
    content: "Regular $4.899, updated 2 hours ago",
  });
  const answering = (status: number, body: unknown) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); };
    return Object.assign(fetchImpl, { calls });
  };

  it("asks Tavily for a basic search of the last week, with dates, and reads the price", async () => {
    const fetchImpl = answering(200, stationPage);
    await expect(fetchTavilyPrice("tvly-key", { station: chevron }, fetchImpl, now)).resolves.toMatchObject({ price: 4.899, kind: "station", asOf: "2026-10-29T16:00:00.000Z" });
    const [{ url, init }] = fetchImpl.calls;
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer tvly-key" });
    expect(JSON.parse(String(init.body))).toEqual({
      query: "Chevron 8101 Beach Blvd, Buena Park, CA 90620, USA regular gas price per gallon",
      topic: "general",
      search_depth: "basic",
      auto_parameters: false,
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_published_date: true,
      time_range: "week",
      max_age_hours: 24,
      country: "united states",
      include_domains: ["gasbuddy.com"],
      include_domains_mode: "prefer",
      exclude_domains: ["reddit.com", "gaspricewatch.com", "yelp.com", "mapquest.com"],
    });
  });

  it("searches an area by name", async () => {
    const fetchImpl = answering(200, result({ content: "Average regular $4.719 as of Oct 27, 2026" }));
    await fetchTavilyPrice("tvly-key", { area: "Orange County, CA" }, fetchImpl, now);
    expect(JSON.parse(String(fetchImpl.calls[0].init.body)).query).toBe("Orange County, CA regular gas price per gallon");
  });

  it("fails when Tavily refuses, including when its live-fetch capacity is full (434)", async () => {
    await expect(fetchTavilyPrice("tvly-key", { area: "Orange County, CA" }, answering(434, {}), now)).rejects.toThrow("Tavily responded 434");
    await expect(fetchTavilyPrice("tvly-key", { area: "Orange County, CA" }, answering(401, {}), now)).rejects.toThrow("Tavily responded 401");
  });
});
