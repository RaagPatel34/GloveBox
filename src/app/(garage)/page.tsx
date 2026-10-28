"use client";

import { ConditionsPanel } from "@/components/conditions-panel";
import { ComingUp } from "@/components/dashboard/ComingUp";
import { DriveReview } from "@/components/dashboard/DriveReview";
import { NextUp } from "@/components/dashboard/NextUp";
import { useGarage } from "@/components/garage/GarageProvider";
import { useDashboard } from "@/components/garage/useDashboard";
import { EmptyGarage } from "@/components/shell/EmptyGarage";

// How is my car? The next thing it needs, the drive review, everything else coming up, and the weather.
export default function DashboardPage() {
  const { garage } = useGarage();
  const dashboard = useDashboard();
  if (!garage || !dashboard) return <EmptyGarage />;
  const [next, ...rest] = dashboard.items;
  return (
    <div className="space-y-8">
      {next ? <NextUp item={next} /> : <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>}
      <DriveReview proposals={dashboard.proposals} />
      <ComingUp items={rest} />
      <ConditionsPanel key={garage.vehicle.id} garage={garage} />
    </div>
  );
}
