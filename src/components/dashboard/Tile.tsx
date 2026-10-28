import { TONE } from "@/components/health/tone";
import type { DashboardItem } from "@/lib/dashboard";
import { SOURCE_TEXT } from "@/lib/garage-view";
import { formatLimit, STATUS_LABEL } from "@/lib/readout";

// One upkeep item: what it is, how it stands, how far through its interval it is,
// and where the interval came from. Status is always written out, never colour alone.
export function Tile({ item }: { item: DashboardItem }) {
  const tone = TONE[item.status];
  const { value, unit } = formatLimit(item.limit);
  const used = item.usedPercent;
  return (
    <li className={`flex flex-col rounded-2xl bg-panel p-4 ring-1 ${tone.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium">{item.label}</h3>
        <span className={`shrink-0 font-mono text-[11px] tracking-[0.1em] uppercase ${tone.text}`}>{STATUS_LABEL[item.status]}</span>
      </div>
      <p className="mt-5 font-mono tabular-nums">
        <span className="text-2xl">{value}</span>
        {unit && <span className="ml-1.5 text-xs tracking-[0.12em] text-muted uppercase">{unit}</span>}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        {used !== null && (
          <div className={`meter-fill h-full origin-left rounded-full ${tone.fill}`} style={{ transform: `scaleX(${Math.min(used, 100) / 100})` }} />
        )}
      </div>
      <p className="mt-2 flex justify-between gap-2 text-xs text-muted">
        <span>{used === null ? "No interval set" : `${used}% of interval`}</span>
        <span>{SOURCE_TEXT[item.source.kind]}</span>
      </p>
    </li>
  );
}
