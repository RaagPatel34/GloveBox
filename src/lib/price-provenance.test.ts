import { describe, expect, it } from "vitest";
import { priceProvenance } from "./price-provenance";
import type { GasPrice } from "./types";

const eia: GasPrice = {
  price: 4.712,
  source: "https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_y05la_w.htm",
  asOf: "2026-10-20",
  kind: "eia",
  label: "Los Angeles weekly regular gasoline average",
};

describe("priceProvenance", () => {
  it("dates an EIA price by its week and links to EIA by name", () => {
    expect(priceProvenance(eia, "America/Los_Angeles")).toEqual({
      kindLabel: "EIA regional average",
      when: { prefix: "week of", date: "Oct 20, 2026" },
      source: { href: eia.source, label: "EIA weekly prices" },
      regional: true,
    });
  });

  it("dates a station price to the minute and names the page it came from", () => {
    const station: GasPrice = { price: 4.39, source: "https://www.gasbuddy.com/station/12345", asOf: "2026-10-28T22:15:00Z", kind: "station" };
    expect(priceProvenance(station, "America/Los_Angeles")).toEqual({
      kindLabel: "Station price",
      when: { prefix: "as of", date: "Oct 28, 2026, 3:15 PM" },
      source: { href: station.source, label: "gasbuddy.com" },
      regional: false,
    });
  });

  it("counts an area figure as regional and keeps a date-only stamp on its day", () => {
    const area: GasPrice = { price: 4.6, source: "https://news.example.org/gas", asOf: "2026-10-27", kind: "area" };
    const provenance = priceProvenance(area, "America/Los_Angeles");
    expect(provenance.when).toEqual({ prefix: "as of", date: "Oct 27, 2026" });
    expect(provenance.regional).toBe(true);
    expect(provenance.source?.label).toBe("news.example.org");
  });

  it("offers no link for a source that is not a web page", () => {
    expect(priceProvenance({ ...eia, source: "javascript:alert(1)" }).source).toBeNull();
    expect(priceProvenance({ ...eia, source: "EIA" }).source).toBeNull();
  });

  it("shows an unreadable timestamp as it came", () => {
    expect(priceProvenance({ ...eia, kind: "area", asOf: "yesterday" }).when.date).toBe("yesterday");
  });
});
