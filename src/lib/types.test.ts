import { describe, expect, it } from "vitest";
import { toErrandStop } from "./types";

describe("toErrandStop", () => {
  it("reads a gas or car-wash stop, and a named place with its name trimmed", () => {
    expect(toErrandStop({ type: "gas" })).toEqual({ type: "gas" });
    expect(toErrandStop({ type: "wash", name: "ignored" })).toEqual({ type: "wash" });
    expect(toErrandStop({ type: "address", name: " Trader Joe's " })).toEqual({ type: "address", name: "Trader Joe's" });
  });

  it("measures a name after trimming it: 200 characters fit, 201 do not, padding doesn't count", () => {
    expect(toErrandStop({ type: "address", name: ` ${"a".repeat(200)} ` })).toEqual({ type: "address", name: "a".repeat(200) });
    expect(toErrandStop({ type: "address", name: "a".repeat(201) })).toBeNull();
  });

  it("refuses anything else", () => {
    for (const value of [null, "gas", 7, {}, { type: "teleport" }, { type: "address" }, { type: "address", name: "  " }, { type: "address", name: 4 }]) {
      expect(toErrandStop(value)).toBeNull();
    }
  });
});
