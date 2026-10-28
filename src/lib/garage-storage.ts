import { isGarage, type Garage } from "./maintenance";

export const CORRUPT_GARAGE = "Saved data could not be restored. Load a fresh demo to continue.";

// What was saved in the browser, read back. Nothing saved is not a problem; saved text
// that is not a valid garage is, and the app says so and offers a fresh demo.
export function parseStoredGarage(raw: string | null): { garage: Garage | null; error: string | null } {
  if (!raw) return { garage: null, error: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isGarage(parsed)) return { garage: parsed, error: null };
  } catch {
    // Unreadable JSON is reported the same way as JSON that is not a garage.
  }
  return { garage: null, error: CORRUPT_GARAGE };
}
