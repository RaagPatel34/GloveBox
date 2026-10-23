import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { HealthDashboard, HealthDashboardSkeleton } from "@/components/health/HealthDashboard";
import { SetupForm } from "@/components/setup/SetupForm";
import { VisitorSync } from "@/components/visitor/VisitorSync";
import { getCarSnapshot } from "@/lib/car";
import { buildDashboard } from "@/lib/dashboard";
import { loadProposals } from "@/lib/db/proposal-store";
import type { Proposal } from "@/lib/types";
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
  // getCarSnapshot only returns a car for a valid visitor ID.
  const proposals = car ? await getProposals(visitorId!) : [];

  return (
    <>
      <VisitorSync serverVisitorId={visitorId} />
      {car ? <HealthDashboard dashboard={buildDashboard(car, now, proposals)} /> : <SetupForm />}
    </>
  );
}

// The proposal cards are extra: if they cannot be read, the dashboard still shows.
async function getProposals(visitorId: string): Promise<Proposal[]> {
  try {
    return await loadProposals(visitorId);
  } catch (error) {
    console.error("Loading proposals failed", error);
    return [];
  }
}
