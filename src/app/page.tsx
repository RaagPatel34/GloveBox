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
  const car = await getCarSnapshot(visitorId);
  // A car exists only for a valid visitor ID, which listNudges needs.
  const nudges = car ? await listNudges(car.vehicle.visitorId, now) : [];

  return (
    <>
      <VisitorSync serverVisitorId={visitorId} />
      {car ? <HealthDashboard dashboard={buildDashboard(car, now)} nudges={nudges} /> : <SetupForm />}
    </>
  );
}
