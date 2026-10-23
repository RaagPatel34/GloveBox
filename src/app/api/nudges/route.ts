import { cookies } from "next/headers";
import { listNudges } from "@/lib/db/nudge-store";
import { VISITOR_COOKIE } from "@/lib/visitor";

// GET -> { nudges: Nudge[] }: the current weather and air-quality nudges for the visitor's car,
// newest first. The dashboard reads the same store directly; the daily job (#16) writes it.
export async function GET() {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  try {
    return Response.json({ nudges: visitorId ? await listNudges(visitorId, new Date()) : [] });
  } catch (error) {
    console.error("GET /api/nudges failed", error);
    return Response.json({ error: "Could not load nudges." }, { status: 500 });
  }
}
