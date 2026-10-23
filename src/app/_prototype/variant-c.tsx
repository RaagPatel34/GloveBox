// PROTOTYPE variant C: timeline. Refs: rivian.com, lexus.com (Inspo).
// One "next up" focus card, then everything else on a rail in the order it comes due.

import type { ItemStatus } from "@/lib/types";
import { byUrgency, dueSummary, fmtDays, fmtMiles, STATUS_LABEL, type Dashboard, type DashboardItem } from "./fixture";

export const name = "Timeline";

const DOT: Record<ItemStatus, string> = {
  overdue: "bg-[#c2410c] ring-[#fde3d5]",
  due_soon: "bg-[#b7791f] ring-[#fbefd6]",
  ok: "bg-[#94a3a0] ring-[#e7ecea]",
};

const PILL: Record<ItemStatus, string> = {
  overdue: "bg-[#fde3d5] text-[#9a3412]",
  due_soon: "bg-[#fbefd6] text-[#8a5a12]",
  ok: "bg-[#e7ecea] text-[#4b5b58]",
};

function bucket(item: DashboardItem) {
  if (item.status === "overdue") return "Overdue";
  if (item.projectedDaysLeft <= 7) return "This week";
  if (item.projectedDaysLeft <= 31) return "This month";
  if (item.projectedDaysLeft <= 92) return "Next few months";
  return "Later";
}

export function VariantC({ data }: { data: Dashboard }) {
  const { vehicle, odometerEstimate } = data;
  const [next, ...rest] = [...data.items].sort(byUrgency);
  const buckets = new Map<string, DashboardItem[]>();
  for (const item of rest) {
    const key = bucket(item);
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  return (
    <div className="min-h-full flex-1 font-sans bg-[#f3f5f4] text-[#18201e]">
      <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:pt-10">
        <header className="flex items-center justify-between text-sm">
          <span className="font-semibold tracking-tight">GloveBox</span>
          <span className="rounded-full bg-white px-3 py-1 text-[#4b5b58] shadow-[0_1px_2px_rgba(0,0,0,0.06)] tabular-nums">
            {vehicle.make} {vehicle.model} · {fmtMiles(odometerEstimate)}
          </span>
        </header>

        {next && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#6b7c78]">Next up</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{next.label}</h1>
            <p className="mt-2 text-lg text-[#4b5b58]">
              {next.status === "overdue" ? "Overdue, " : "Due "}
              {fmtDays(next.projectedDaysLeft)}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[#e7ecea] pt-5 text-sm">
              <div>
                <dt className="text-[#6b7c78]">When</dt>
                <dd className="mt-1 tabular-nums">{dueSummary(next)}</dd>
              </div>
              <div>
                <dt className="text-[#6b7c78]">Interval from</dt>
                <dd className="mt-1">{next.source.kind === "manufacturer" ? "Manufacturer" : "Baseline table"}</dd>
              </div>
            </dl>
          </section>
        )}

        <ol className="mt-10">
          {[...buckets].map(([heading, group]) => (
            <li key={heading} className="mb-8">
              <h2 className="pl-8 text-xs font-medium uppercase tracking-[0.1em] text-[#6b7c78]">{heading}</h2>
              <ol className="relative mt-3 border-l border-[#d5dddb] ml-[7px]">
                {group.map((item) => (
                  <li key={item.kind} className="relative pb-5 pl-6 last:pb-0">
                    <span
                      className={`absolute -left-[6px] top-1.5 size-[11px] rounded-full ring-4 ${DOT[item.status]}`}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-medium">{item.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-[#4b5b58]">{dueSummary(item)}</p>
                    {item.source.kind === "manufacturer" && (
                      <p className="mt-1 text-xs text-[#6b7c78]">Manufacturer interval</p>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
