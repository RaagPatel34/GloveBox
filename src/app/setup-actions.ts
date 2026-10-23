"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { saveCar } from "@/lib/db/car-store";
import { createEpaClient } from "@/lib/epa";
import { geocode } from "@/lib/geocode";
import { buildSnapshot, parseSetupInput, type SetupErrors } from "@/lib/setup";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/visitor";

export type SetupState = { errors?: SetupErrors; message?: string };

const epaClient = createEpaClient();

// Server Functions are reachable by direct POST, so everything is re-validated here.
// The EPA numbers come from fueleconomy.gov again, never from what the browser sent.
export async function saveCarAction(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = parseSetupInput(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  const input = parsed.value;

  let snapshot;
  try {
    const [epaVehicle, home] = await Promise.all([epaClient.vehicle(input.epaVehicleId), geocode(input.home)]);
    if (epaVehicle === null) return { errors: { epaVehicleId: "That car was not found. Pick it again." } };
    if (home === null) return { errors: { home: "Could not find that place. Try a city and state, or a ZIP code." } };
    snapshot = buildSnapshot({ input, epaVehicle, home, now: new Date(), newId: randomUUID });
    await saveCar(input.visitorId, snapshot);
  } catch (error) {
    console.error("saveCarAction failed", error);
    return { message: "Could not save your car. Please try again." };
  }

  (await cookies()).set(VISITOR_COOKIE, input.visitorId, {
    maxAge: VISITOR_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
