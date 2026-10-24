import { CommandBar } from "@/components/command/CommandBar";
import { LoadDemoCarButton } from "@/components/demo/LoadDemoCarButton";
import { ProposalCards } from "@/components/proposals/ProposalCards";
import type { Dashboard } from "@/lib/dashboard";
import type { Nudge } from "@/lib/types";
import { ItemTile } from "./ItemTile";
import { NudgeList } from "./NudgeList";
import { OdometerHero } from "./OdometerHero";

// "Instrument panel": an estimated-odometer hero with a status count strip, the command
// bar, proposals and weather nudges, followed by upkeep.
export function HealthDashboard({ dashboard, nudges = [] }: { dashboard: Dashboard; nudges?: Nudge[] }) {
  const { vehicle, odometerEstimate, readingAt, counts, items } = dashboard;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <span className="text-foreground">GloveBox</span>
        <h1 className="text-right font-normal">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
      </header>

      <OdometerHero
        vehicle={vehicle}
        odometerEstimate={odometerEstimate}
        readingAt={readingAt}
        counts={counts}
      />

      <NudgeList nudges={nudges} />

      <CommandBar />

      <ProposalCards cards={dashboard.proposals} />

      <h2 className="sr-only">Upkeep, most urgent first</h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <ItemTile key={item.id} item={item} />
        ))}
      </ul>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
        <p className="text-sm text-muted">Load the demo car to replace this car, or to reset the demo.</p>
        <LoadDemoCarButton className="rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground ring-1 ring-white/20 transition-opacity hover:ring-white/40 disabled:opacity-40" />
      </footer>
    </main>
  );
}

// Shown while the dashboard waits for a request (it depends on the current time).
export function HealthDashboardSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading dashboard"
      className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 sm:px-6 sm:pt-10"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">GloveBox</p>
      <div className="mt-6 h-40 rounded-2xl bg-panel ring-1 ring-white/5 sm:mt-8" />
    </main>
  );
}
