"use client";

import { useGarage } from "@/components/garage/GarageProvider";
import { EmptyGarage } from "@/components/shell/EmptyGarage";
import { TripPlanner } from "@/components/trip-planner";
import { vehicleMpg } from "@/lib/trip";

// What will this drive cost? The trip agent, the manual route planner and the gas-detour calculator.
export default function TripsPage() {
  const { garage } = useGarage();
  if (!garage) return <EmptyGarage />;
  const mpg = vehicleMpg(garage.vehicle);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">Trips</h1>
      {/* Route planner and detour calculator side by side on wide screens, stacked on phones. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <TripPlanner key={`${garage.vehicle.id}-${mpg}`} mpg={mpg} home={garage.vehicle.home} />
      </div>
    </div>
  );
}
