import { describe, expect, it } from "vitest";
import { MAX_EMBED_WAYPOINTS, routeEmbedUrl, tripRoutePoints } from "./route-embed";

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

  it("gives no URL for fewer than two points or more waypoints than the embed takes", () => {
    expect(routeEmbedUrl(["1,2"], key)).toBeNull();
    const ok = Array.from({ length: MAX_EMBED_WAYPOINTS + 2 }, (_, i) => `${i},${i}`);
    expect(routeEmbedUrl(ok, key)).not.toBeNull();
    expect(routeEmbedUrl([...ok, "9,9"], key)).toBeNull();
  });

  it("keeps addresses (the old planner's stops) intact", () => {
    const url = parse(routeEmbedUrl(["1 A St, Buena Park, CA", "2 B St, Santa Ana, CA"], key));
    expect(url.searchParams.get("origin")).toBe("1 A St, Buena Park, CA");
  });
});
