// PROTOTYPE variant A: triage list. Refs: cartesia.ai, functionhealth.com (Inspo).
// Warm paper, one sentence answering "what needs me?", rows grouped by urgency.

import type { ItemStatus } from "@/lib/types";
import { byUrgency, dueSummary, fmtMiles, STATUS_LABEL, type Dashboard } from "./fixture";

export const name = "Triage list";

const TONE: Record<ItemStatus, { dot: string; text: string }> = {
  overdue: { dot: "bg-[#b45c34]", text: "text-[#9a4a26]" },
  due_soon: { dot: "bg-[#c48a2c]", text: "text-[#87601c]" },
  ok: { dot: "bg-[#5f8a6c]", text: "text-[#46684f]" },
};

const GROUPS: { status: ItemStatus; heading: string }[] = [
  { status: "overdue", heading: "Needs doing now" },
  { status: "due_soon", heading: "Coming up soon" },
  { status: "ok", heading: "All good" },
];

export function VariantA({ data }: { data: Dashboard }) {
  const { vehicle, odometerEstimate, counts } = data;
  const items = [...data.items].sort(byUrgency);
  const attention = counts.overdue + counts.due_soon;

  return (
    <div className="min-h-full flex-1 font-sans bg-[#f6f3ee] text-[#1d1b17]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10">
        <header className="flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">GloveBox</span>
          <span className="text-[#6b665c]">
            {vehicle.year} {vehicle.make} {vehicle.model} ·{" "}
            <span className="tabular-nums">{fmtMiles(odometerEstimate)}</span>
          </span>
        </header>

        <section className="mt-10 sm:mt-16">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {attention === 0 ? (
              "Everything's on schedule."
            ) : (
              <>
                {attention} {attention === 1 ? "thing needs" : "things need"} you.
                <span className="text-[#8a8478]"> The other {counts.ok} are fine.</span>
              </>
            )}
          </h1>
          <p className="mt-3 text-[15px] text-[#6b665c]">
            Estimated odometer from your last reading plus {vehicle.weeklyMiles} mi a week.
          </p>
        </section>

        {GROUPS.map(({ status, heading }) => {
          const group = items.filter((i) => i.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status} className="mt-10" aria-labelledby={`group-${status}`}>
              <h2
                id={`group-${status}`}
                className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#6b665c]"
              >
                {heading}
                <span className="tabular-nums text-[#a39d91]">{group.length}</span>
              </h2>
              <ul className="mt-3 divide-y divide-[#e4ded3] border-y border-[#e4ded3]">
                {group.map((item) => (
                  <li key={item.kind} className="flex items-start gap-3 py-4">
                    <span className={`mt-2 size-2 shrink-0 rounded-full ${TONE[status].dot}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="font-medium">{item.label}</span>
                        <span className={`text-sm font-medium ${TONE[status].text}`}>{STATUS_LABEL[status]}</span>
                      </div>
                      <p className="mt-1 text-sm tabular-nums text-[#4f4a42]">Due {dueSummary(item)}</p>
                      <p className="mt-1 text-xs text-[#8a8478]">
                        {item.source.kind === "manufacturer" ? (
                          <a href={item.source.url} className="underline decoration-[#cfc8bb] underline-offset-2 hover:text-[#1d1b17]">
                            Manufacturer interval
                          </a>
                        ) : (
                          "Baseline interval"
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
