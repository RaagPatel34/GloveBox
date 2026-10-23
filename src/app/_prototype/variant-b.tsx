// PROTOTYPE variant B: instrument panel. Refs: turnoev.com, bugatti.com (Inspo).
// Dark cluster, odometer as the hero readout, every item as a gauge of interval used.

import type { ItemStatus } from "@/lib/types";
import { byUrgency, fmtDate, fmtMiles, STATUS_LABEL, type Dashboard, type DashboardItem } from "./fixture";

export const name = "Instrument panel";

const TONE: Record<ItemStatus, { bar: string; text: string; ring: string }> = {
  overdue: { bar: "bg-[#ff6a3d]", text: "text-[#ff8a63]", ring: "ring-[#ff6a3d]/40" },
  due_soon: { bar: "bg-[#f2a815]", text: "text-[#f5bd4a]", ring: "ring-[#f2a815]/30" },
  ok: { bar: "bg-[#5fd0a0]", text: "text-[#7fdcb3]", ring: "ring-white/10" },
};

function readout(item: DashboardItem) {
  // The tighter of the two limits is the one worth showing.
  const days = item.daysLeft ?? Infinity;
  const milesAsDays = item.projectedDaysLeft;
  if (item.milesLeft !== undefined && milesAsDays < days) {
    return item.milesLeft < 0
      ? { value: fmtMiles(-item.milesLeft), unit: "over" }
      : { value: fmtMiles(item.milesLeft), unit: "left" };
  }
  if (item.daysLeft !== undefined) {
    const n = Math.abs(item.daysLeft);
    return { value: `${n} ${n === 1 ? "day" : "days"}`, unit: item.daysLeft < 0 ? "late" : "left" };
  }
  return { value: "—", unit: "" };
}

export function VariantB({ data }: { data: Dashboard }) {
  const { vehicle, odometerEstimate, readingAt, counts } = data;
  const items = [...data.items].sort(byUrgency);
  const digits = String(odometerEstimate).padStart(6, "0");

  return (
    <div className="min-h-full flex-1 font-sans bg-[#0d0e0f] text-[#e9e7e2]">
      <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10">
        <header className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b8a86]">
          <span className="text-[#e9e7e2]">GloveBox</span>
          <span>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </span>
        </header>

        <section className="mt-8 grid gap-6 rounded-2xl bg-[#151719] p-5 ring-1 ring-white/5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b8a86]">Odometer · estimated</p>
            <p className="mt-3 flex gap-1 font-mono text-4xl tabular-nums sm:text-6xl" aria-label={fmtMiles(odometerEstimate)}>
              {digits.split("").map((d, i) => (
                <span key={i} className="rounded-md bg-black/50 px-1.5 py-1 ring-1 ring-white/5 sm:px-2">
                  {d}
                </span>
              ))}
              <span className="self-end pb-1 pl-1 text-base text-[#8b8a86] sm:text-lg">mi</span>
            </p>
            <p className="mt-3 font-mono text-xs text-[#8b8a86]">
              Read {fmtDate(readingAt)} · +{vehicle.weeklyMiles} mi/wk
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 font-mono text-center">
            {(["overdue", "due_soon", "ok"] as const).map((s) => (
              <div key={s} className={`rounded-xl bg-black/40 px-3 py-3 ring-1 ${TONE[s].ring}`}>
                <dd className={`text-2xl tabular-nums ${TONE[s].text}`}>{counts[s]}</dd>
                <dt className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#8b8a86]">{STATUS_LABEL[s]}</dt>
              </div>
            ))}
          </dl>
        </section>

        <ul className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const r = readout(item);
            const pct = Math.min(item.used, 1) * 100;
            return (
              <li key={item.kind} className={`flex flex-col rounded-2xl bg-[#151719] p-4 ring-1 ${TONE[item.status].ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-snug">{item.label}</span>
                  <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${TONE[item.status].text}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-5 font-mono tabular-nums">
                  <span className="text-2xl">{r.value}</span>{" "}
                  <span className="text-xs uppercase tracking-[0.12em] text-[#8b8a86]">{r.unit}</span>
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="meter"
                  aria-label={`${item.label} interval used`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.used * 100)}
                >
                  <div className={`h-full rounded-full ${TONE[item.status].bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f6e6a]">
                  <span>{Math.round(item.used * 100)}% used</span>
                  <span>{item.source.kind === "manufacturer" ? "Mfr" : "Baseline"}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
