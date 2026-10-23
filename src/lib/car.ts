import type { CarSnapshot } from "./dashboard";
import { demoCar } from "./fixtures/demo-car";

// The one place the dashboard gets its car from.
// Today that is the demo fixture; the "car setup saves a real car" ticket swaps the body
// for a lookup of the visitor's saved car (falling back to this fixture for "Load demo car").
export async function getCarSnapshot(now: Date): Promise<CarSnapshot> {
  return demoCar(now);
}
