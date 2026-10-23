import { loadCar } from "./db/car-store";
import type { CarSnapshot } from "./types";
import { isVisitorId } from "./visitor";

// The one place the dashboard gets its car from: the visitor's saved car in Postgres,
// or null when they have not set one up yet (the page then shows the setup form).
//
// The demo fixture (src/lib/fixtures/demo-car.ts) is deliberately not wired in here;
// the "Load demo car" ticket decides how to offer it.
export async function getCarSnapshot(visitorId: string | undefined): Promise<CarSnapshot | null> {
  if (!isVisitorId(visitorId)) return null;
  return loadCar(visitorId);
}
