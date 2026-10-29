import { describe, expect, it } from "vitest";
import { createGarage, logService, setSchedule } from "./garage";
import { dueBasis } from "./garage-view";
import { demoGarage, isGarage, type Garage } from "./maintenance";
import { applyMfrSchedule, lookupMfrSchedule } from "./mfr-schedule";

const CIVIC = { year: 2019, make: "Honda", model: "Civic" };

const FILTER_SOURCE = "https://owners.honda.com/2019-civic/filters/";
const SCHEDULE_SOURCE = "https://owners.honda.com/2019-civic/schedule/";
const COSTA = "https://www.costaoils.com/blog/2019-honda-civic-oil-change";

// What Tavily answers: each result's `content` is up to three chunks joined by " [...] ".
function tavily(results: { url: string; content: string; score?: number }[]) {
  return async () =>
    Response.json({ results: results.map((r) => ({ title: "Honda Civic maintenance", score: 0.5, ...r })) });
}

describe("lookupMfrSchedule on the demo Civic", () => {
  it("reads the oil, rotation, filter and brake intervals and keeps each one's own source link", async () => {
    const fetcher = tavily([
      {
        url: FILTER_SOURCE,
        content:
          "Maintenance Minder Sub-Code 2: Replace air cleaner element every 15,000 miles. Replace dust and pollen filter every 15,000 miles in city driving.",
      },
      {
        url: SCHEDULE_SOURCE,
        content:
          "Oil and filter change: every 7,500 miles or 12 months.\nRotate tires every 7,500 miles.\nBrake inspection every 7,500 miles. [...] Spark plugs: see your manual.",
      },
      { url: COSTA, content: "A full synthetic oil change on a Civic is due about every 7,500 miles." },
    ]);

    const result = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });

    expect(result.status).toBe("ok");
    expect(result.intervals).toEqual([
      { kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE },
      { kind: "tire_rotation", intervalMiles: 7500, url: SCHEDULE_SOURCE },
      { kind: "cabin_filter", intervalMiles: 15000, url: FILTER_SOURCE },
      { kind: "engine_filter", intervalMiles: 15000, url: FILTER_SOURCE },
      { kind: "brake_check", intervalMiles: 7500, url: SCHEDULE_SOURCE },
    ]);
  });
});

describe("what is not accepted as a manufacturer interval", () => {
  it("drops numbers outside the plausible range for the item (TC-02)", async () => {
    const fetcher = tavily([
      { url: SCHEDULE_SOURCE, content: "Replace spark plugs and engine oil every 150,000 miles." },
      { url: FILTER_SOURCE, content: "Oil change every 500 miles if you enjoy it. Tire rotation every 500 miles." },
    ]);
    expect(await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher })).toEqual({ status: "empty", intervals: [] });
  });

  it("ignores forums, unknown sites and addresses that cannot be stored", async () => {
    const good = "Oil change every 7,500 miles or 12 months.";
    const fetcher = tavily([
      { url: "https://www.reddit.com/r/Honda/comments/abc", content: good },
      { url: "https://best-car-tips.example/civic", content: good },
      { url: "http://www.sussexhonda.com/civic", content: good },
    ]);
    expect((await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher })).intervals).toEqual([]);
  });

  it("rejects dealer guidance even with a higher search score", async () => {
    const owners = "https://owners.honda.com/vehicles/information/2019/Civic-Sedan/maintenance";
    const fetcher = tavily([
      { url: "https://www.hondaoflincoln.com/2019-honda-civic-maintenance-schedule/", score: 0.99, content: "Oil change every 5,000 miles." },
      { url: owners, score: 0.1, content: "Oil change every 7,500 miles or 12 months." },
    ]);
    const { intervals } = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([{ kind: "oil", intervalMiles: 7500, intervalDays: 365, url: owners }]);
  });

  it("reads the lower end of a range and does not borrow a neighbouring line's mileage", async () => {
    const fetcher = tavily([
      {
        url: SCHEDULE_SOURCE,
        content:
          "Oil change: 7,500 – 10,000 miles or 12 months\nTransmission fluid every 30,000 miles\nCabin air filter: replace as needed\nBrake pads typically last 25,000 to 70,000 miles",
      },
    ]);
    const { intervals } = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([{ kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE }]);
  });

  it("reads a grid whose mileage is a heading over its items", async () => {
    const toyota = "https://www.toyota.com/2022/camry/maintenance-schedule";
    const fetcher = tavily([
      {
        url: toyota,
        content:
          "Every 5,000 miles or 6 months:\nRotate tires\nInspect front and rear brakes\nEvery 15,000 miles:\nReplace cabin air filter\nEvery 30,000 miles:\nReplace engine air filter",
      },
    ]);
    const { intervals } = await lookupMfrSchedule({ year: 2022, make: "Toyota", model: "Camry" }, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([
      { kind: "tire_rotation", intervalMiles: 5000, intervalDays: 183, url: toyota },
      { kind: "cabin_filter", intervalMiles: 15000, url: toyota },
      { kind: "engine_filter", intervalMiles: 30000, url: toyota },
      { kind: "brake_check", intervalMiles: 5000, intervalDays: 183, url: toyota },
    ]);
  });
});

describe("a Tavily problem never throws (TC-03, TC-04)", () => {
  const nothing = { intervals: [] };

  it("reports a rate limit, an outage or a broken answer as unavailable", async () => {
    const options = { apiKey: "test-only" };
    expect(await lookupMfrSchedule(CIVIC, { ...options, fetcher: async () => new Response("slow down", { status: 429 }) })).toEqual({
      status: "unavailable",
      ...nothing,
    });
    expect(
      await lookupMfrSchedule(CIVIC, {
        ...options,
        fetcher: async () => {
          throw new Error("HTTP 429 Too Many Requests");
        },
      }),
    ).toEqual({ status: "unavailable", ...nothing });
    expect(await lookupMfrSchedule(CIVIC, { ...options, fetcher: async () => new Response("<html>") })).toEqual({
      status: "unavailable",
      ...nothing,
    });
  });

  it("reports a search with no results as empty", async () => {
    expect(await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher: tavily([]) })).toEqual({ status: "empty", ...nothing });
  });

  it("gives up on a hung request at the timeout and cancels it", async () => {
    let cancelled = false;
    const hangs: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          cancelled = true;
          reject(init.signal?.reason);
        });
      });
    const started = Date.now();
    const result = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher: hangs, timeoutMs: 50 });
    expect(result).toEqual({ status: "timeout", ...nothing });
    expect(cancelled).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("the search it sends", () => {
  it("asks Tavily for this car, with forums excluded and no generated answer", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const fetcher: typeof fetch = async (url, init) => {
      sent = { url: String(url), init: init ?? {} };
      return Response.json({ results: [] });
    };
    await lookupMfrSchedule(CIVIC, { apiKey: "key-123", fetcher });

    expect(sent?.url).toBe("https://api.tavily.com/search");
    expect(new Headers(sent?.init.headers).get("Authorization")).toBe("Bearer key-123");
    const body = JSON.parse(String(sent?.init.body));
    expect(body.query).toContain("2019 Honda Civic");
    expect(body).toMatchObject({ search_depth: "advanced", include_answer: false, auto_parameters: false });
    expect(body.exclude_domains).toEqual(expect.arrayContaining(["reddit.com", "youtube.com"]));
    expect(body).not.toHaveProperty("include_domains");
  });
});

describe("applyMfrSchedule", () => {
  const NOW = new Date("2026-10-29T12:00:00Z");
  const OIL = { kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE } as const;
  const CABIN = { kind: "cabin_filter", intervalMiles: 15000, url: FILTER_SOURCE } as const;
  const newCar = () =>
    createGarage({ year: 2019, make: "Honda", model: "Civic", odometer: 48000, mpg: 34, location: "Buena Park, CA" }, NOW);
  const item = (garage: Garage, kind: string) => garage.items.find((i) => i.kind === kind)!;

  it("gives a new car's empty items the manufacturer interval, its link and a plain note", () => {
    const garage = applyMfrSchedule(newCar(), [OIL, CABIN]);

    expect(item(garage, "oil")).toMatchObject({
      intervalMiles: 7500,
      intervalDays: 365,
      intervalSource: { kind: "manufacturer", url: SCHEDULE_SOURCE },
    });
    expect(item(garage, "oil").intervalSource.note).toContain("owners.honda.com");
    expect(item(garage, "cabin_filter")).toMatchObject({ intervalMiles: 15000, intervalSource: { kind: "manufacturer", url: FILTER_SOURCE } });
    expect(isGarage(garage)).toBe(true);
  });

  it("does not invent a service: no due date until one is recorded", () => {
    const oil = item(applyMfrSchedule(newCar(), [OIL]), "oil");
    expect(oil.dueAt).toBeUndefined();
    expect(oil.dueOdometer).toBeUndefined();
    expect(oil.lastDoneAt).toBeUndefined();
  });

  it("counts from a service recorded while the lookup was running", () => {
    const logged = logService(newCar(), { itemId: "oil", date: "2026-10-01", odometer: 47500, notes: "" }, NOW);
    const oil = item(applyMfrSchedule(logged, [OIL]), "oil");
    expect(oil.dueOdometer).toBe(55000);
    expect(oil.dueAt).toBe(new Date(Date.parse(oil.lastDoneAt!) + 365 * 86_400_000).toISOString());
  });

  it("leaves wash, tire pressure and anything the owner already set alone", () => {
    const own = setSchedule(newCar(), { itemId: "oil", miles: 5000, note: "My manual, normal driving" });
    const garage = applyMfrSchedule(own, [OIL, CABIN]);

    expect(item(garage, "oil")).toEqual(item(own, "oil"));
    expect(item(garage, "wash")).toEqual(item(own, "wash"));
    expect(item(garage, "tire_pressure")).toEqual(item(own, "tire_pressure"));
  });

  it("leaves the demo car's illustrative dates alone", () => {
    const demo = demoGarage(NOW);
    expect(applyMfrSchedule(demo, [OIL, CABIN])).toBe(demo);
  });

  it("changes nothing when there is nothing to add", () => {
    const garage = newCar();
    expect(applyMfrSchedule(garage, [])).toBe(garage);
  });
});

describe("the demo Civic with no lookup (acceptance 1: the baseline is kept and the card says so)", () => {
  it("shows its oil interval as an illustrative baseline to check against the owner's manual", () => {
    const oil = demoGarage(new Date("2026-10-29T12:00:00Z")).items.find((i) => i.kind === "oil")!;
    expect(oil.intervalSource).toEqual({ kind: "baseline" });
    expect(dueBasis(oil)).toContain("Illustrative baseline");
    expect(dueBasis(oil)).toContain("Check your owner’s manual");
  });
});

describe("review fixes", () => {
  it("does not take a site for a dealer just because its name contains the make", async () => {
    const good = "Oil change every 5,000 miles.";
    const ford = { year: 2021, make: "Ford", model: "F-150" };
    const ram = { year: 2021, make: "Ram", model: "1500" };
    const fordResults = tavily([{ url: "https://affordable-autos.com/oil", content: good }]);
    const ramResults = tavily([{ url: "https://programs.com/oil", content: good }]);
    expect((await lookupMfrSchedule(ford, { apiKey: "test-only", fetcher: fordResults })).intervals).toEqual([]);
    expect((await lookupMfrSchedule(ram, { apiKey: "test-only", fetcher: ramResults })).intervals).toEqual([]);
  });

  it("reads a matching maker page for a different make", async () => {
    const dealer = "https://www.ford.com/2021/f-150/maintenance";
    const ford = { year: 2021, make: "Ford", model: "F-150" };
    const fetcher = tavily([{ url: dealer, content: "Oil change every 10,000 miles or 12 months." }]);
    expect((await lookupMfrSchedule(ford, { apiKey: "test-only", fetcher })).intervals).toEqual([
      { kind: "oil", intervalMiles: 10000, intervalDays: 365, url: dealer },
    ]);
  });

  it("does not give an item the previous item's mileage", async () => {
    const owners = "https://owners.honda.com/2019/civic/maintenance";
    const fetcher = tavily([{ url: owners, content: "Tire rotation every 7,500 miles, wiper blade inspection as needed" }]);
    const { intervals } = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([{ kind: "tire_rotation", intervalMiles: 7500, url: owners }]);
  });

  it("still reads a mileage written before its items", async () => {
    const fetcher = tavily([{ url: SCHEDULE_SOURCE, content: "At 7,500 miles: oil change, rotate tires" }]);
    const { intervals } = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([
      { kind: "oil", intervalMiles: 7500, url: SCHEDULE_SOURCE },
      { kind: "tire_rotation", intervalMiles: 7500, url: SCHEDULE_SOURCE },
    ]);
  });

  it("reads items listed after a heading on the same line", async () => {
    const fetcher = tavily([{ url: SCHEDULE_SOURCE, content: "Every 7,500 miles or 12 months: Oil and filter change; Tire rotation" }]);
    const { intervals } = await lookupMfrSchedule(CIVIC, { apiKey: "test-only", fetcher });
    expect(intervals).toEqual([
      { kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE },
      { kind: "tire_rotation", intervalMiles: 7500, intervalDays: 365, url: SCHEDULE_SOURCE },
    ]);
  });
});
