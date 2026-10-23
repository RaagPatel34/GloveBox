import { loadCar } from "./db/car-store";
import type { CarSnapshot } from "./types";
import { isVisitorId } from "./visitor";

// The one place the dashboard gets its car from: the visitor's saved car in Postgres,
// or null when they have not set one up yet (the page then shows the setup form).
//
// The demo car is not special-cased here: "Load demo car" (src/app/demo-actions.ts) saves it
// as the visitor's car, so it is read back like any other.
export async function getCarSnapshot(visitorId: string | undefined): Promise<CarSnapshot | null> {
  if (!isVisitorId(visitorId)) return null;
  return loadCar(visitorId);
}
