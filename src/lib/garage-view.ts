import { safeUrl, type Garage } from "./maintenance";
import { numberFormat } from "./readout";
import type { CarSnapshot, ScheduleItem } from "./types";

// How the local garage is shown on the four pages. Pure, so the wording is tested once.

// The local garage as the dashboard's car. An older backup has no reading time; its
// odometer is then taken as read now, as the local garage has always treated it.
export function garageToSnapshot(garage: Garage, now: Date): CarSnapshot {
  return {
    vehicle: garage.vehicle,
    readingAt: garage.readingAt ?? now.toISOString(),
    plannedTripMiles: garage.plannedTripMiles,
    items: garage.items,
  };
}

// Where an interval came from, in words.
export const SOURCE_TEXT: Record<ScheduleItem["intervalSource"]["kind"], string> = {
  baseline: "Illustrative baseline",
  manufacturer: "Manufacturer schedule",
  user: "Your record",
  nhtsa: "NHTSA guidance",
};

// The words for an interval's source, and its link when there is a page to open: only a manufacturer
// interval carries one.
export function sourceAnchor(source: ScheduleItem["intervalSource"]): { text: string; href?: string } {
  const text = SOURCE_TEXT[source.kind];
  return source.kind === "manufacturer" && safeUrl(source.url) ? { text, href: source.url } : { text };
}

// Same zone as readout.ts: GloveBox is a California app.
const basisDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

// "Why this date?": the interval's source, the interval, and the service it counts from.
export function dueBasis(item: ScheduleItem): string {
  const every = [
    item.intervalDays !== undefined ? `${numberFormat.format(item.intervalDays)} days` : null,
    item.intervalMiles !== undefined ? `${numberFormat.format(item.intervalMiles)} mi` : null,
  ].filter((part) => part !== null);
  const lastDone = item.lastDoneAt === undefined ? null : new Date(item.lastDoneAt);
  const hasLast = lastDone !== null && !Number.isNaN(lastDone.getTime());

  let text = SOURCE_TEXT[item.intervalSource.kind];
  if (every.length > 0) {
    text += `: every ${every.join(" or ")}`;
    text += hasLast ? `, counted from your last one on ${basisDateFormat.format(lastDone)}.` : ". No service recorded yet.";
  } else {
    text += hasLast ? `. Last done ${basisDateFormat.format(lastDone)}.` : ". No service recorded yet.";
  }
  if (item.intervalSource.kind === "baseline") text += " Check your owner’s manual for your car’s schedule.";
  return text;
}

export type WheelEntry = { kind: "digit"; digit: number; turns: number } | { kind: "sep"; char: string };

// One drum per digit of a readout like "48,000". On the way in, the ones drum spins two
// extra turns and the tens drum one, like a real odometer; anything else is printed as is.
export function wheelPlan(value: string): WheelEntry[] {
  const chars = [...value];
  let fromRight = chars.filter((char) => /\d/.test(char)).length;
  return chars.map((char): WheelEntry => {
    if (!/\d/.test(char)) return { kind: "sep", char };
    fromRight--;
    return { kind: "digit", digit: Number(char), turns: fromRight === 0 ? 2 : fromRight === 1 ? 1 : 0 };
  });
}

// PR #2 kept its sections behind hashes on one page; old links land on the matching page.
const LEGACY_HASHES: Record<string, "/" | "/log" | "/trips" | "/car"> = {
  "#overview": "/",
  "#records": "/log",
  "#trips": "/trips",
  "#guidance": "/car",
};

export function legacyHashRoute(hash: string): "/" | "/log" | "/trips" | "/car" | null {
  return Object.hasOwn(LEGACY_HASHES, hash) ? LEGACY_HASHES[hash] : null;
}
