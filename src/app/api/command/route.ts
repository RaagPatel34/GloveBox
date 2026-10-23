import { cookies } from "next/headers";
import { getCarSnapshot } from "@/lib/car";
import { runCommand } from "@/lib/command";
import { commandReply } from "@/lib/command-reply";
import { updateCar } from "@/lib/db/car-store";
import { addProposals, loadProposals } from "@/lib/db/proposal-store";
import { missingNebiusConfig, nebiusChat } from "@/lib/nebius";
import { VISITOR_COOKIE } from "@/lib/visitor";

// The command bar: POST { text } -> CommandReply. The car is the one the visitor cookie
// points at, the same one the dashboard shows. The logic lives in src/lib/command.ts.
export async function POST(request: Request) {
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
      chat: missing.length > 0 ? null : nebiusChat(),
      now: new Date(),
      save: (next) => updateCar(visitorId!, next),
      saveProposals: (proposals) => addProposals(visitorId!, proposals),
    });
    return Response.json(reply);
  } catch (error) {
    console.error("POST /api/command failed", error);
    return Response.json(commandReply(null, "Could not load your car. Please try again."), { status: 500 });
  }
}
