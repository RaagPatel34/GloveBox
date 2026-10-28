"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { useGarage } from "@/components/garage/GarageProvider";
import { useDashboard } from "@/components/garage/useDashboard";
import { TONE } from "@/components/health/tone";
import { RollingNumber, Wheel } from "@/components/motion/RollingNumber";
import { useIgnitedOnce } from "@/components/motion/useIgnitedOnce";
import { odometerDigits } from "@/lib/dashboard";
import { wheelPlan } from "@/lib/garage-view";
import { numberFormat, STATUS_LABEL } from "@/lib/readout";
import type { ItemStatus } from "@/lib/types";
import { NAV, type PageHref } from "./nav";
import { PlannedMiles } from "./PlannedMiles";

const COUNT_ORDER: ItemStatus[] = ["overdue", "due_soon", "ok", "unknown"];

// The car at a glance, on every page: a left rail on wide screens, a sticky strip on phones.
export function Rail({ current }: { current: PageHref | null }) {
  const dashboard = useDashboard();
  const planned = useGarage().garage?.plannedTripMiles ?? 0;
  useIgnitedOnce(dashboard !== null);
  return (
    <aside
      aria-label="Your car"
      className="sticky top-0 z-10 border-b border-white/[0.06] bg-rail/95 backdrop-blur-md lg:h-dvh lg:border-r lg:border-b-0 lg:bg-rail"
    >
      <div className="flex h-full flex-col gap-6 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] lg:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <Link href="/" className="font-mono text-[11px] tracking-[0.14em] uppercase">
            GloveBox
          </Link>
          {dashboard && (
            <span className="truncate text-sm text-muted lg:hidden">
              {dashboard.vehicle.year} {dashboard.vehicle.make} {dashboard.vehicle.model}
              {dashboard.vehicle.isDemo && " · Demo car"}
            </span>
          )}
        </div>

        {dashboard && (
          <>
            <div className="hidden lg:block">
              <p className="text-sm text-muted">
                {dashboard.vehicle.year} {dashboard.vehicle.make}
              </p>
              <p className="text-2xl font-medium tracking-tight">{dashboard.vehicle.model}</p>
              {dashboard.vehicle.isDemo && <p className="mt-1 text-xs text-muted">Demo car · illustrative records</p>}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 max-lg:-mt-3 lg:block">
              <Odometer miles={dashboard.odometerEstimate} planned={planned} />
              <dl className="flex flex-wrap gap-x-3 gap-y-1 lg:mt-5 lg:block lg:space-y-2">
                {COUNT_ORDER.filter((status) => status !== "unknown" || dashboard.counts.unknown > 0).map((status) => (
                  <div key={status} className="flex items-center gap-1.5 lg:justify-between">
                    <dt className="flex items-center gap-2 text-sm text-muted">
                      <span aria-hidden className={`size-2 rounded-full ${TONE[status].fill}`} />
                      <span className="max-lg:text-xs">{STATUS_LABEL[status]}</span>
                    </dt>
                    <dd className={`font-mono tabular-nums ${TONE[status].text}`}>
                      <span className="sr-only">{dashboard.counts[status]}</span>
                      <RollingNumber value={String(dashboard.counts[status])} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <PlannedMiles className="hidden lg:block" />
          </>
        )}

        <nav aria-label="Main" className="hidden flex-col gap-1 lg:flex">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current === href ? "page" : undefined}
              className="relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground aria-[current=page]:text-foreground"
            >
              {/* One shared plate, so it slides between items on a page change. */}
              {current === href && (
                <ViewTransition name="rail-plate" share="plate" default="none">
                  <span aria-hidden className="absolute inset-0 rounded-lg bg-white/[0.07]" />
                </ViewTransition>
              )}
              <Icon className="relative" />
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

// The estimated odometer as digit tiles, like the real one: six places, more past 999,999.
function Odometer({ miles, planned }: { miles: number; planned: number }) {
  return (
    <div>
      <p className="sr-only lg:not-sr-only lg:mb-2 lg:text-sm lg:text-muted">Odometer, estimated</p>
      <p role="img" aria-label={`${numberFormat.format(miles)} miles, estimated`} className="flex gap-0.5 font-mono text-lg tabular-nums lg:text-2xl">
        {wheelPlan(odometerDigits(miles).join("")).map((entry, index) =>
          entry.kind === "digit" ? (
            <span key={index} aria-hidden className="rounded bg-black/60 px-[0.28em] py-[0.12em] ring-1 ring-white/5">
              <Wheel digit={entry.digit} turns={entry.turns} />
            </span>
          ) : null,
        )}
        <span aria-hidden className="self-end pl-1 text-xs text-muted">
          mi
        </span>
      </p>
      {planned > 0 && <p className="mt-1 text-xs text-muted">Includes {numberFormat.format(planned)} planned mi</p>}
    </div>
  );
}
