"use client";

import { useGarage } from "@/components/garage/GarageProvider";
import { setMileagePlan } from "@/lib/garage";
import { numberFormat } from "@/lib/readout";

// Planned trip miles push every reminder forward. The rail carries it on wide screens;
// the Service log carries it on phones.
export function PlannedMiles({ className = "" }: { className?: string }) {
  const { garage, save } = useGarage();
  if (!garage) return null;
  const planned = garage.plannedTripMiles ?? 0;
  return (
    <label className={`block text-sm ${className}`}>
      <span className="flex justify-between text-muted">
        <span>Planned trip miles</span>
        <span className="font-mono tabular-nums text-foreground">{numberFormat.format(planned)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={2000}
        step={50}
        value={planned}
        onChange={(event) => save(setMileagePlan(garage, garage.vehicle.weeklyMiles, Number(event.target.value)))}
        className="mt-2 h-6 w-full accent-foreground"
      />
      <span className="mt-1 block text-xs text-muted">Projects every reminder forward. Never changes the recorded odometer.</span>
    </label>
  );
}
