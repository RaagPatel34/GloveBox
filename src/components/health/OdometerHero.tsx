import { odometerDigits } from "@/lib/dashboard";
import { formatReadDate, numberFormat, STATUS_LABEL } from "@/lib/readout";
import type { ItemStatus, Vehicle } from "@/lib/types";
import { TONE } from "./tone";

const STATUS_ORDER: ItemStatus[] = ["overdue", "due_soon", "ok"];

export function OdometerHero({
  vehicle,
  odometerEstimate,
  readingAt,
  counts,
}: {
  vehicle: Pick<Vehicle, "weeklyMiles">;
  odometerEstimate: number;
  readingAt: Date;
  counts: Record<ItemStatus, number>;
}) {
  return (
    <section
      aria-label="Odometer and status summary"
      className="mt-6 grid gap-6 rounded-2xl bg-panel p-5 ring-1 ring-white/5 sm:mt-8 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8"
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Odometer · estimated</p>
        <p
          role="img"
          aria-label={`${numberFormat.format(odometerEstimate)} miles`}
          className="mt-3 flex items-end gap-1 sm:gap-1.5 font-mono text-[clamp(1.5rem,7.5vw,2.25rem)] tabular-nums sm:text-6xl"
        >
          {odometerDigits(odometerEstimate).map((digit, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="rounded-md bg-black/50 px-[0.3em] py-[0.15em] leading-none ring-1 ring-white/5"
            >
              {digit}
            </span>
          ))}
          <span aria-hidden="true" className="pb-1 pl-1 text-base text-muted sm:text-lg">
            mi
          </span>
        </p>
        <p className="mt-3 font-mono text-xs text-muted">
          Read {formatReadDate(readingAt)} · +{numberFormat.format(vehicle.weeklyMiles)} mi/wk
        </p>
      </div>

      <dl aria-label="Items by status" className="grid grid-cols-3 gap-2 text-center">
        {STATUS_ORDER.map((status) => (
          // Term first in the markup (valid <dl>); the count is shown above its label.
          <div
            key={status}
            className={`flex flex-col-reverse rounded-xl bg-black/40 px-3 py-3 ring-1 ${TONE[status].ring}`}
          >
            <dt className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {STATUS_LABEL[status]}
            </dt>
            <dd className={`font-mono text-2xl tabular-nums ${TONE[status].text}`}>{counts[status]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
