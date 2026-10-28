"use client";

import { useEffect, useState } from "react";
import { MileageForecast, RecordService, ServiceHistory, UpdateOdometer } from "@/components/garage-tools";
import { useGarage } from "@/components/garage/GarageProvider";
import type { Garage } from "@/lib/maintenance";
import { EmptyGarage } from "@/components/shell/EmptyGarage";
import { PlannedMiles } from "@/components/shell/PlannedMiles";
import { panelClass } from "@/components/shell/ui";

// What has been done? The history first, with the forms that add to it beside it.
export default function ServiceLogPage() {
  const { garage, save, logFor, setLogFor } = useGarage();
  // "Log this service" hands over an item. Next keeps visited pages alive (hidden in
  // <Activity>), so this page may already be mounted: take each new hand-over when the
  // page is shown again, not only on first mount. Visits from the nav keep the last pick.
  const [arrivedFor, setArrivedFor] = useState(logFor);
  if (logFor !== null && logFor !== arrivedFor) setArrivedFor(logFor);
  useEffect(() => {
    if (logFor !== null) setLogFor(null);
  }, [logFor, setLogFor]);
  // Each tool reports its own result, so changes made here leave the shared notice alone.
  const saveQuietly = (next: Garage) => save(next);

  if (!garage) return <EmptyGarage />;
  const initialItemId = garage.items.some((item) => item.id === arrivedFor) ? (arrivedFor ?? undefined) : garage.items[0]?.id;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">Service log</h1>
      <PlannedMiles className={`lg:hidden ${panelClass}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <ServiceHistory garage={garage} />
        <div className="space-y-6">
          <RecordService key={`${garage.vehicle.id}-${initialItemId}`} garage={garage} onSave={saveQuietly} initialItemId={initialItemId} />
          <UpdateOdometer garage={garage} onSave={saveQuietly} />
        </div>
      </div>
      <MileageForecast garage={garage} onSave={saveQuietly} />
    </div>
  );
}
