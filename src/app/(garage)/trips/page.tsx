"use client";

import { useGarage } from "@/components/garage/GarageProvider";
import { EmptyGarage } from "@/components/shell/EmptyGarage";

// Placeholder until the page is built (plan Task 5).
export default function Page() {
  const { garage } = useGarage();
  if (!garage) return <EmptyGarage />;
  return <h1 className="text-2xl font-medium tracking-tight">trips</h1>;
}
