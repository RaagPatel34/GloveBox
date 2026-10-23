// The anonymous visitor ID. localStorage is the source of truth (see docs/SPEC.md); a cookie
// carries the same value so server components can tell whose car to load.
// It is a random UUID acting as an unguessable bearer token: whoever holds it owns that car.

export const VISITOR_COOKIE = "gb_visitor";
export const VISITOR_STORAGE_KEY = "glovebox.visitorId";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type VisitorResolution = { id: string; saveToStorage: boolean; saveToCookie: boolean };

// Decides which id to use and which of the two places need (re)writing.
export function resolveVisitorId(input: {
  stored: string | null | undefined;
  cookie: string | null | undefined;
  generate: () => string;
}): VisitorResolution {
  if (isVisitorId(input.stored)) {
    return { id: input.stored, saveToStorage: false, saveToCookie: input.cookie !== input.stored };
  }
  if (isVisitorId(input.cookie)) {
    return { id: input.cookie, saveToStorage: true, saveToCookie: false };
  }
  return { id: input.generate(), saveToStorage: true, saveToCookie: true };
}
