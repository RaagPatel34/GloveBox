"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { saveCar } from "@/lib/db/car-store";
import { demoCar } from "@/lib/fixtures/demo-car";
import { demoNudge } from "@/lib/fixtures/demo-nudge";
import { isVisitorId } from "@/lib/visitor";
import { setVisitorCookie } from "@/lib/visitor-cookie";

export type DemoCarState = { message?: string };

// Replaces whatever car this visitor has with the demo car, so clicking it again always
// lands on the same starting picture. Works for a first-time visitor too: the browser
// sends the ID it just made, and saveCar creates the car under it.
export async function loadDemoCarAction(_previous: DemoCarState, formData: FormData): Promise<DemoCarState> {
  const visitorId = formData.get("visitorId");
  if (!isVisitorId(visitorId)) return { message: "Missing visitor ID. Reload the page and try again." };

  try {
    const now = new Date();
    const car = demoCar(now, visitorId, randomUUID);
    // The car's nudge comes from the real forecast; demoNudge never throws if Open-Meteo is down.
    const nudge = await demoNudge(car, now, randomUUID);
    await saveCar(visitorId, car, nudge ? [nudge] : []);
  } catch (error) {
    console.error("loadDemoCarAction failed", error);
    return { message: "Could not load the demo car. Please try again." };
  }

  await setVisitorCookie(visitorId);
  redirect("/garage");
}
