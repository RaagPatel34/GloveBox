import type { GasPrice } from "./types";

export type PriceProvenance = {
  // The existing pill: what kind of price this is.
  kindLabel: string;
  // When the price was true: "week of" + "Oct 20, 2026" for EIA, "as of" + "Oct 28, 2026, 3:15 PM"
  // for a station or area price. The date sets in mono, so it is kept apart from its prefix.
  when: { prefix: "week of" | "as of"; date: string };
  // Where the price came from, labelled by what it is. Null when the source is not a web link.
  source: { href: string; label: string } | null;
  // A regional average (EIA or an area figure), not a quote from one station.
  regional: boolean;
};

const KIND_LABEL = { eia: "EIA regional average", area: "Area average", station: "Station price" } as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A date without a time is a calendar day, read in UTC so it never slips a day; a timestamp is
// shown in `timeZone` (the viewer's own when left out).
function readableDate(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (DATE_ONLY.test(iso)) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  // Some ICU versions put a narrow no-break space before AM/PM; read it as a plain space.
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }).replace(/\s/g, " ");
}

function sourceLink(price: GasPrice): PriceProvenance["source"] {
  let url: URL;
  try {
    url = new URL(price.source);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const label = price.kind === "eia" ? "EIA weekly prices" : url.hostname.replace(/^www\./, "");
  return { href: url.href, label };
}

// Everything the trip result says about where a gas price came from and when it was true.
export function priceProvenance(price: GasPrice, timeZone?: string): PriceProvenance {
  return {
    kindLabel: KIND_LABEL[price.kind],
    when: { prefix: price.kind === "eia" ? "week of" : "as of", date: readableDate(price.asOf, timeZone) },
    source: sourceLink(price),
    regional: price.kind !== "station",
  };
}
