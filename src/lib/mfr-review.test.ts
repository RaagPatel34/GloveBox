import { describe, expect, it } from "vitest";
import { createGarage } from "./garage";
import { applyMfrSchedule, lookupMfrSchedule, requestMfrSchedule } from "./mfr-schedule";

const CIVIC = { year: 2019, make: "Honda", model: "Civic" };
const SOURCE = "https://owners.honda.com/vehicles/information/2019/Civic-Sedan/maintenance";
const lookup = (content: string, url = SOURCE) => lookupMfrSchedule(CIVIC, {
  apiKey: "fixture", fetcher: async () => Response.json({ results: [{ url, content }] }),
});

describe("manufacturer schedule review regressions", () => {
  it.each([
    "Oil change as needed, tire rotation every 7,500 miles.",
    "Oil change every 150,000 miles, tire rotation every 7,500 miles.",
    "Oil change as needed, tire rotation every 7,500 miles or 6 months.",
  ])("does not borrow another service's numbers: %s", async (content) => {
    const result = await lookup(content);
    expect(result.intervals.map(i => i.kind)).toEqual(["tire_rotation"]);
  });
  it.each([
    ["2016 Honda Accord: Oil change every 5,000 miles.", "https://owners.honda.com/vehicles/information/2016/Accord/maintenance"],
    ["2019 Honda Accord: Oil change every 5,000 miles.", "https://owners.honda.com/vehicles/information/2019/Accord/maintenance"],
    ["Oil change every 5,000 miles.", "https://owners.honda.com/maintenance"],
  ])("keeps the fallback for an inapplicable or unspecified vehicle: %s", async (content, url) => {
    expect((await lookup(content, url)).intervals).toEqual([]);
  });
  it.each([
    "https://www.kbb.com/honda/civic/2019/maintenance/",
    "https://www.hondaoflincoln.com/2019-honda-civic-maintenance-schedule/",
  ])("does not designate independent advice as manufacturer guidance: %s", async (url) => {
    expect((await lookup("Oil change every 7,500 miles.", url)).intervals).toEqual([]);
    const garage = createGarage({ ...CIVIC, mpg: 34, odometer: 48000, location: "Buena Park, CA" });
    const intervals = [{ kind: "oil" as const, intervalMiles: 7500, url }];
    expect(applyMfrSchedule(garage, intervals)).toBe(garage);
    expect(await requestMfrSchedule(CIVIC, async () => Response.json({ intervals }))).toEqual([]);
  });
  it("accepts a matching official manufacturer's interval", async () => {
    expect((await lookup("Oil change every 7,500 miles or 12 months.")).intervals).toEqual([
      { kind: "oil", intervalMiles: 7500, intervalDays: 365, url: SOURCE },
    ]);
  });
});
