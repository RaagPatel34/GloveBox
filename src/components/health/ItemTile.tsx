import type { DashboardItem } from "@/lib/dashboard";
import { formatLimit, STATUS_LABEL } from "@/lib/readout";
import { TONE } from "./tone";

const SOURCE_LABEL = { baseline: "Baseline", manufacturer: "Manufacturer", user: "Your record", nhtsa: "NHTSA" } as const;

export function ItemTile({ item }: { item: DashboardItem }) {
  const tone = TONE[item.status];
  const { value, unit } = formatLimit(item.limit);
  const used = item.usedPercent;

  return (
    <li className={`flex flex-col rounded-2xl bg-panel p-4 ring-1 ${tone.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{item.label}</h3>
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${tone.text}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <p className="mt-5 font-mono tabular-nums">
        <span className="text-2xl">{value}</span>
        {unit && <span className="ml-1.5 text-xs uppercase tracking-[0.12em] text-muted">{unit}</span>}
      </p>

      {used === null ? (
        <div className="mt-3 h-1.5 rounded-full bg-white/10" aria-hidden="true" />
      ) : (
        <div
          role="meter"
          aria-label={`${item.label}: interval used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(used, 100)}
          aria-valuetext={`${used}% used`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          {/* Coloured by status, as the spec's rule defines it, not by % used. */}
          <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${Math.min(used, 100)}%` }} />
        </div>
      )}

      <p className="mt-2 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>{used === null ? "Interval unknown" : `${used}% used`}</span>
        <span>{SOURCE_LABEL[item.source.kind]}</span>
      </p>
    </li>
  );
}
