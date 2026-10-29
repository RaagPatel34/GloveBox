"use client";

import { useState } from "react";
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
  // Items an applied suggestion just moved; their tiles read "Changed" until noticed.
  const [changed, setChanged] = useState<string[]>([]);
  if (!garage || !dashboard) return <EmptyGarage />;
  const [next, ...rest] = dashboard.items;
  return (
    <div className="space-y-8">
      {next ? <NextUp item={next} /> : <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>}
      <DriveReview
        proposals={dashboard.proposals}
        onReview={() => setChanged([])}
        onApplied={(itemId) => setChanged((ids) => [...ids.filter((id) => id !== itemId), itemId])}
      />
      <ComingUp items={rest} changed={changed} onSeen={(itemId) => setChanged((ids) => ids.filter((id) => id !== itemId))} />
      <ConditionsPanel key={garage.vehicle.id} garage={garage} />
    </div>
  );
}
