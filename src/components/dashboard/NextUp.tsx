"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGarage } from "@/components/garage/GarageProvider";
import { TONE } from "@/components/health/tone";
import { isRollable, RollingNumber } from "@/components/motion/RollingNumber";
import { ArrowIcon } from "@/components/shell/icons";
import { primaryButton, quietButton } from "@/components/shell/ui";
import type { DashboardItem } from "@/lib/dashboard";
import { dueBasis } from "@/lib/garage-view";
import { formatLimit, STATUS_LABEL } from "@/lib/readout";

// The one thing the car needs next, and the two things you can do about it.
export function NextUp({ item }: { item: DashboardItem }) {
  const { garage, setLogFor } = useGarage();
  const router = useRouter();
  const [why, setWhy] = useState(false);
  const tone = TONE[item.status];
  const limit = formatLimit(item.limit);
  const scheduleItem = garage?.items.find((candidate) => candidate.id === item.id);

  return (
    <section aria-labelledby="next-up-h" className={`rounded-2xl bg-panel p-6 ring-1 sm:p-8 ${tone.ring}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <h1 id="next-up-h" className="text-[clamp(1.75rem,4vw,2.6rem)] leading-tight font-medium tracking-tight">
          <span className="sr-only">Next up: </span>
          {item.label}
        </h1>
        <p className="w-full font-mono tabular-nums sm:w-auto sm:text-right">
          <span className={`text-[clamp(2.5rem,6vw,3.75rem)] leading-none ${tone.text}`}>
            {isRollable(limit.value) ? (
              <>
                <span className="sr-only">{limit.value}</span>
                <RollingNumber value={limit.value} />
              </>
            ) : (
              limit.value
            )}
          </span>
          <span className="block text-xs tracking-[0.12em] text-muted uppercase">
            {limit.unit ? `${limit.unit} · ` : ""}
            {STATUS_LABEL[item.status]}
          </span>
        </p>
      </div>
      {why && scheduleItem && (
        <p id="next-up-basis" className="mt-4 max-w-[60ch] text-sm text-muted">
          {dueBasis(scheduleItem)}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setLogFor(item.id);
            router.push("/log");
          }}
          className={primaryButton}
        >
          Log this service <ArrowIcon />
        </button>
        <button type="button" onClick={() => setWhy((open) => !open)} aria-expanded={why} aria-controls="next-up-basis" className={quietButton}>
          {why ? "Hide the basis" : "Why this date?"}
        </button>
      </div>
    </section>
  );
}
