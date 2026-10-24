import { cookies } from "next/headers";
import { getCarSnapshot } from "@/lib/car";
import { runCommand } from "@/lib/command";
import { updateCar } from "@/lib/db/car-store";
import { missingNebiusConfig, nebiusChat } from "@/lib/nebius";
import type { CommandReply } from "@/lib/types";
import { VISITOR_COOKIE } from "@/lib/visitor";

// The command bar: POST { text } -> CommandReply. The car is the one the visitor cookie
// points at, the same one the dashboard shows. The logic lives in src/lib/command.ts.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const reply: CommandReply = { model: null, message: "Send the command as JSON: { text }.", changes: [] };
    return Response.json(reply, { status: 400 });
  }
  const text = typeof body === "object" && body !== null ? (body as Record<string, unknown>).text : undefined;
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;

  const missing = missingNebiusConfig(["nano", "super"]);
  if (missing.length > 0) console.warn(`Command bar is offline: ${missing.join(", ")} not set`);

  try {
    const car = await getCarSnapshot(visitorId);
    const reply = await runCommand({
      text,
      car,
      chat: missing.length > 0 ? null : nebiusChat(),
      now: new Date(),
      // getCarSnapshot only returns a car for a valid visitor ID.
      save: (next) => updateCar(visitorId!, next, car ?? undefined),
    });
    return Response.json(reply);
  } catch (error) {
    console.error("POST /api/command failed", error);
    const reply: CommandReply = { model: null, message: "Could not load your car. Please try again.", changes: [] };
    return Response.json(reply, { status: 500 });
  }
}
