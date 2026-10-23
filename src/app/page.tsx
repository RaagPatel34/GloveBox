import { connection } from "next/server";
import { Suspense } from "react";
import { HealthDashboard, HealthDashboardSkeleton } from "@/components/health/HealthDashboard";
import { getCarSnapshot } from "@/lib/car";
import { buildDashboard } from "@/lib/dashboard";

export default function Home() {
  return (
    <Suspense fallback={<HealthDashboardSkeleton />}>
      <LiveDashboard />
    </Suspense>
  );
}

// Statuses depend on the current time, so this renders per request rather than
// being baked into the static shell.
async function LiveDashboard() {
  await connection();
  const now = new Date();
  const car = await getCarSnapshot(now);
  return <HealthDashboard dashboard={buildDashboard(car, now)} />;
}
