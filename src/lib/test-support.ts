import { DAY_MS } from "./intervals";

// Shared by the unit tests: one fixed "now" and a helper for dates relative to it.
export const NOW = new Date("2026-10-22T12:00:00.000Z");
export const inDays = (n: number) => new Date(NOW.getTime() + n * DAY_MS).toISOString();
