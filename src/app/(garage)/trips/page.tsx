"use client";

import { useGarage } from "@/components/garage/GarageProvider";
import { EmptyGarage } from "@/components/shell/EmptyGarage";
import { TripPlanner } from "@/components/trip-planner";

// What will this drive cost? The route planner and the gas-detour calculator.
export default function TripsPage() {
  const { garage } = useGarage();
  if (!garage) return <EmptyGarage />;
  const mpg = garage.vehicle.mpgOverride || garage.vehicle.epaMpg;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">Trips</h1>
      <TripPlanner key={`${garage.vehicle.id}-${mpg}`} mpg={mpg} />
    </div>
  );
}
