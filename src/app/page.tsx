import { loadProposals } from "@/lib/db/proposal-store";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { HealthDashboard, HealthDashboardSkeleton } from "@/components/health/HealthDashboard";
import { SetupForm } from "@/components/setup/SetupForm";
import { VisitorSync } from "@/components/visitor/VisitorSync";
import { getCarSnapshot } from "@/lib/car";
import { buildDashboard } from "@/lib/dashboard";
import { listNudges } from "@/lib/db/nudge-store";
import { VISITOR_COOKIE } from "@/lib/visitor";

export default function Home() {
  return (
    <Suspense fallback={<HealthDashboardSkeleton />}>
      <LiveDashboard />
    </Suspense>
  );
}

// Which car to show depends on the visitor's cookie, and statuses depend on the current time,
// so this renders per request rather than being baked into the static shell.
async function LiveDashboard() {
  await connection();
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  const now = new Date();
  // The nudges need only the visitor ID, not the car, so both load at once. listNudges
  // returns none for an invalid ID. Nudges are a bonus: if their table is missing (migration
  // not run) or the database hiccups, the car still shows, as GET /api/nudges would answer 500.
  const [car, nudges, proposals] = await Promise.all([
    getCarSnapshot(visitorId),
    listNudges(visitorId ?? "", now).catch((error) => {
      console.error("Could not load nudges for the dashboard", error);
      return [];
    }),
    loadProposals(visitorId ?? "").catch((error) => {
      console.error("Could not load schedule suggestions", error);
      return [];
    }),
  ]);

  return (
    <>
      <VisitorSync serverVisitorId={visitorId} />
      {car ? <HealthDashboard dashboard={buildDashboard(car, now, proposals)} nudges={nudges} /> : <SetupForm />}
    </>
  );
}
