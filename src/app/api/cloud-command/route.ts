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
  const reply = (message: string, status: number) => Response.json({ model: null, message, changes: [] }, { status });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return reply("Cross-origin requests are not accepted.", 403);
  if (process.env.ENABLE_LIVE_AI !== "true") return reply("Live AI is paused. Use the local garage for service records and sample suggestions.", 503);
  if (!process.env.DATABASE_URL) return reply("Cloud storage is not configured. Your local garage remains available.", 503);
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
      save: (next) => updateCar(visitorId!, next),
    });
    return Response.json(reply);
  } catch (error) {
    console.error("POST /api/command failed", error);
    const reply: CommandReply = { model: null, message: "Could not load your car. Please try again.", changes: [] };
    return Response.json(reply, { status: 500 });
  }
}
