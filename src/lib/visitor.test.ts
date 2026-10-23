import { describe, expect, it } from "vitest";
import { isVisitorId, resolveVisitorId } from "./visitor";

const A = "3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11";
const B = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
const generate = () => B;

describe("isVisitorId", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(isVisitorId(A)).toBe(true);
    expect(isVisitorId(A.toUpperCase())).toBe(true);
    expect(isVisitorId("demo")).toBe(false);
    expect(isVisitorId("")).toBe(false);
    expect(isVisitorId(undefined)).toBe(false);
    expect(isVisitorId(`${A}; drop table`)).toBe(false);
  });
});

describe("resolveVisitorId", () => {
  it("makes a new id for a first-time visitor and says to save it in both places", () => {
    expect(resolveVisitorId({ stored: null, cookie: undefined, generate })).toEqual({
      id: B,
      saveToStorage: true,
      saveToCookie: true,
    });
  });

  it("keeps the id in localStorage as the source of truth, mirroring it to the cookie", () => {
    expect(resolveVisitorId({ stored: A, cookie: undefined, generate })).toEqual({
      id: A,
      saveToStorage: false,
      saveToCookie: true,
    });
    expect(resolveVisitorId({ stored: A, cookie: B, generate })).toEqual({
      id: A,
      saveToStorage: false,
      saveToCookie: true,
    });
  });

  it("does nothing when both places already agree", () => {
    expect(resolveVisitorId({ stored: A, cookie: A, generate })).toEqual({
      id: A,
      saveToStorage: false,
      saveToCookie: false,
    });
  });

  it("recovers the id from the cookie if localStorage was cleared", () => {
    expect(resolveVisitorId({ stored: null, cookie: A, generate })).toEqual({
      id: A,
      saveToStorage: true,
      saveToCookie: false,
    });
  });

  it("ignores stored values that are not UUIDs", () => {
    expect(resolveVisitorId({ stored: "garbage", cookie: "also-garbage", generate }).id).toBe(B);
  });
});
