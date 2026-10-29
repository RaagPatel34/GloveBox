import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { RouteMap } from "./route-map";

const render = (points: string[], headingLevel: 3 | 4) =>
  renderToStaticMarkup(createElement(RouteMap, { points, headingLevel }));

afterEach(() => {
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
});

describe("RouteMap", () => {
  it("titles itself one level under the heading it sits beneath", () => {
    expect(render(["1,2", "3,4"], 3)).toContain("<h3>Route map</h3>");
    expect(render(["1,2", "3,4"], 4)).toContain("<h4>Route map</h4>");
  });

  it("renders nothing for fewer than two points", () => {
    expect(render([], 4)).toBe("");
    expect(render(["1,2"], 4)).toBe("");
  });

  it("renders nothing for points the embed cannot take", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = "browser-key";
    expect(render(["1 A St", "2 B St | 3 C St", "4 D St"], 3)).toBe("");
  });

  it("offers to load the map when there is a key, without loading it", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = "browser-key";
    const html = render(["1,2", "3,4"], 4);
    expect(html).toContain("Load route map");
    expect(html).not.toContain("<iframe");
  });

  it("says the map is waiting for a connection when there is no key", () => {
    const html = render(["1,2", "3,4"], 4);
    expect(html).toContain("waiting for a Google Maps connection");
    expect(html).not.toContain("Load route map");
  });
});
