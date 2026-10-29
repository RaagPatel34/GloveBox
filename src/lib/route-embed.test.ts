import { describe, expect, it } from "vitest";
import { MAX_TRIP_STOPS } from "./trip";
import { EMBED_API_MAX_WAYPOINTS, MAX_EMBED_POINTS, canDrawRoute, routeEmbedUrl, tripRoutePoints } from "./route-embed";

const home = { lat: 33.8442, lng: -118.0006, label: "Knott's Berry Farm, Buena Park, CA" };
const stop = (lat: number, lng: number) => ({ lat, lng, label: `${lat} address`, type: "address" as const });

describe("tripRoutePoints", () => {
  it("drives home, the stops in plan order, then home, as coordinates", () => {
    const points = tripRoutePoints(home, [stop(33.8582, -118.0001), stop(33.7466, -117.9139)]);
    expect(points).toEqual([
      "33.8442,-118.0006",
      "33.8582,-118.0001",
      "33.7466,-117.9139",
      "33.8442,-118.0006",
    ]);
  });

  it("draws nothing for a plan with no stops, since home to home is no route", () => {
    expect(tripRoutePoints(home, [])).toEqual([]);
  });

  it("always fits a full plan: eight stops plus home at both ends", () => {
    const stops = Array.from({ length: MAX_TRIP_STOPS }, (_, i) => stop(33 + i / 100, -118));
    const points = tripRoutePoints(home, stops);
    expect(points).toHaveLength(MAX_TRIP_STOPS + 2);
    expect(canDrawRoute(points)).toBe(true);
    expect(routeEmbedUrl(points, "browser-key")).not.toBeNull();
  });
});

describe("the embed's point limit", () => {
  it("is the trip's stop limit plus home at both ends, within what the Embed API takes", () => {
    expect(MAX_EMBED_POINTS).toBe(MAX_TRIP_STOPS + 2);
    expect(MAX_EMBED_POINTS - 2).toBeLessThanOrEqual(EMBED_API_MAX_WAYPOINTS);
  });
});

describe("routeEmbedUrl", () => {
  const key = "browser-key";
  const points = ["33.8442,-118.0006", "33.8582,-118.0001", "33.7466,-117.9139", "33.8442,-118.0006"];
  const parse = (url: string | null) => new URL(url!);

  it("builds a driving Directions embed from home to home through the stops", () => {
    const url = parse(routeEmbedUrl(points, key));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/embed/v1/directions");
    expect(url.searchParams.get("origin")).toBe("33.8442,-118.0006");
    expect(url.searchParams.get("destination")).toBe("33.8442,-118.0006");
    expect(url.searchParams.get("waypoints")).toBe("33.8582,-118.0001|33.7466,-117.9139");
    expect(url.searchParams.get("mode")).toBe("driving");
    expect(url.searchParams.get("key")).toBe(key);
  });

  it("encodes the waypoint separator and sends nothing but the browser key", () => {
    const raw = routeEmbedUrl(points, key)!;
    expect(raw).not.toContain("|");
    expect([...new URL(raw).searchParams.keys()].sort()).toEqual(["destination", "key", "mode", "origin", "waypoints"]);
  });

  it("leaves waypoints out when there is nothing between the ends", () => {
    const url = parse(routeEmbedUrl(["1,2", "3,4"], key));
    expect(url.searchParams.has("waypoints")).toBe(false);
  });

  it("gives no URL without a browser key", () => {
    expect(routeEmbedUrl(points, undefined)).toBeNull();
    expect(routeEmbedUrl(points, "  ")).toBeNull();
  });

  it("gives no URL for fewer than two points or more than the limit", () => {
    expect(routeEmbedUrl(["1,2"], key)).toBeNull();
    const atLimit = Array.from({ length: MAX_EMBED_POINTS }, (_, i) => `${i},${i}`);
    expect(routeEmbedUrl(atLimit, key)).not.toBeNull();
    expect(routeEmbedUrl([...atLimit, "9,9"], key)).toBeNull();
  });

  it("gives no URL for a blank point, a point with a waypoint separator, or an overlong one", () => {
    expect(routeEmbedUrl(["1,2", "  ", "3,4"], key)).toBeNull();
    expect(routeEmbedUrl(["1,2", "", "3,4"], key)).toBeNull();
    expect(routeEmbedUrl(["1 A St", "2 B St | 3 C St", "4 D St"], key)).toBeNull();
    expect(routeEmbedUrl(["1,2", "x".repeat(200)], key)).toBeNull();
    expect(routeEmbedUrl(["1,2", "x".repeat(199)], key)).not.toBeNull();
  });

  it("trims the points it sends", () => {
    const url = parse(routeEmbedUrl(["  1 A St ", " 2 B St", "3 C St  "], key));
    expect(url.searchParams.get("origin")).toBe("1 A St");
    expect(url.searchParams.get("waypoints")).toBe("2 B St");
    expect(url.searchParams.get("destination")).toBe("3 C St");
  });

  it("still takes coordinates", () => {
    const url = parse(routeEmbedUrl(["33.9,-118.0", "33.8,-117.9"], key));
    expect(url.searchParams.get("origin")).toBe("33.9,-118.0");
  });

  it("keeps addresses (the old planner's stops) intact", () => {
    const url = parse(routeEmbedUrl(["1 A St, Buena Park, CA", "2 B St, Santa Ana, CA"], key));
    expect(url.searchParams.get("origin")).toBe("1 A St, Buena Park, CA");
  });
});

describe("canDrawRoute", () => {
  it("agrees with the URL builder about which points can be drawn", () => {
    expect(canDrawRoute(["1,2", "3,4"])).toBe(true);
    expect(canDrawRoute([])).toBe(false);
    expect(canDrawRoute(["1,2"])).toBe(false);
    expect(canDrawRoute(["1,2", " "])).toBe(false);
    expect(canDrawRoute(["1,2", "a|b"])).toBe(false);
  });
});
