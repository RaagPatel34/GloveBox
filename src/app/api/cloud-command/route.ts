import { cookies } from "next/headers";
import { getCarSnapshot } from "@/lib/car";
import { runCommand } from "@/lib/command";
import { commandReply } from "@/lib/command-reply";
import { updateCar } from "@/lib/db/car-store";
import { addProposals, loadProposals } from "@/lib/db/proposal-store";
import { missingNebiusConfig, nebiusChat } from "@/lib/nebius";
import { tripServices } from "@/lib/trip-services";
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
    return Response.json(commandReply(null, "Send the command as JSON: { text }."), { status: 400 });
  }
  const text = typeof body === "object" && body !== null ? (body as Record<string, unknown>).text : undefined;
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;

  const missing = missingNebiusConfig(["nano", "super"]);
  if (missing.length > 0) console.warn(`Command bar is offline: ${missing.join(", ")} not set`);

  try {
    const car = await getCarSnapshot(visitorId);
    // getCarSnapshot only returns a car for a valid visitor ID.
    const pending = car ? (await loadProposals(visitorId!)).filter((p) => p.state === "pending") : [];
    const reply = await runCommand({
      text,
      car,
      pending,
      trip: tripServices(),
      chat: missing.length > 0 ? null : nebiusChat(),
      now: new Date(),
      save: (next) => updateCar(visitorId!, next, car ?? undefined),
      saveProposals: (proposals) => addProposals(visitorId!, proposals),
    });
    return Response.json(reply);
  } catch (error) {
    console.error("POST /api/command failed", error);
    return Response.json(commandReply(null, "Could not load your car. Please try again."), { status: 500 });
  }
}
