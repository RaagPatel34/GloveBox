"use client";

import { useMemo } from "react";
import { buildDashboard, type Dashboard } from "@/lib/dashboard";
import { garageToSnapshot } from "@/lib/garage-view";
import { useGarage } from "./GarageProvider";

// The dashboard readout for the saved garage, or null when there is no car yet.
export function useDashboard(): Dashboard | null {
  const { garage, now } = useGarage();
  return useMemo(
    () => (garage ? buildDashboard(garageToSnapshot(garage, now), now, garage.proposals) : null),
    [garage, now],
  );
}
