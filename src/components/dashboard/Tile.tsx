import { useRef, type CSSProperties } from "react";
import { TONE } from "@/components/health/tone";
import { isRollable, RollingNumber } from "@/components/motion/RollingNumber";
import type { DashboardItem } from "@/lib/dashboard";
import { SOURCE_TEXT } from "@/lib/garage-view";
import { formatLimit, STATUS_LABEL } from "@/lib/readout";

// One upkeep item: what it is, how it stands, how far through its interval it is,
// and where the interval came from. Status is always written out, never colour alone.
// A tile you just changed reads "Changed" and holds a foreground ring until you notice it:
// the pointer rests on it for a moment, so a tile sliding under a resting cursor isn't cleared at once.
const NOTICED_MS = 1200;

export function Tile({
  item,
  changed = false,
  onSeen,
  flipRef,
}: {
  item: DashboardItem;
  changed?: boolean;
  onSeen?: () => void;
  flipRef?: (el: HTMLElement | null) => void;
}) {
  const tone = TONE[item.status];
  const { value, unit } = formatLimit(item.limit);
  const used = item.usedPercent;
  const noticing = useRef<number | null>(null);
  function startNoticing() {
    if (!changed || !onSeen || noticing.current !== null) return;
    noticing.current = window.setTimeout(() => {
      noticing.current = null;
      onSeen();
    }, NOTICED_MS);
  }
  function stopNoticing() {
    if (noticing.current !== null) window.clearTimeout(noticing.current);
    noticing.current = null;
  }
  return (
    <li
      ref={flipRef}
      onPointerEnter={startNoticing}
      onPointerLeave={stopNoticing}
      className={`flex flex-col rounded-2xl bg-panel p-4 ring-1 ${tone.ring} ${changed ? "lit" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium">{item.label}</h3>
        <span className={`shrink-0 font-mono text-[11px] tracking-[0.1em] uppercase ${changed ? "text-foreground" : tone.text}`}>
          {changed ? (
            <>
              Changed<span className="sr-only">, {STATUS_LABEL[item.status]}</span>
            </>
          ) : (
            STATUS_LABEL[item.status]
          )}
        </span>
      </div>
      <p className="mt-5 font-mono tabular-nums">
        <span className="text-2xl">
          {isRollable(value) ? (
            <>
              <span className="sr-only">{value}</span>
              <RollingNumber value={value} />
            </>
          ) : (
            value
          )}
        </span>
        {unit && <span className="ml-1.5 text-xs tracking-[0.12em] text-muted uppercase">{unit}</span>}
      </p>
      {/* No interval, no scale: an empty track would read as "0% used". The row keeps its
          height so tiles stay aligned and FLIP stays steady. */}
      <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${used === null ? "" : "bg-white/10"}`} aria-hidden>
        {used !== null && (
          <div
            className={`meter-fill h-full origin-left rounded-full ${tone.fill}`}
            style={{ "--fill": Math.min(used, 100) / 100 } as CSSProperties}
          />
        )}
      </div>
      <p className="mt-2 flex justify-between gap-2 text-xs text-muted">
        <span>{used === null ? "No interval set" : `${used}% of interval`}</span>
        <span>{SOURCE_TEXT[item.source.kind]}</span>
      </p>
    </li>
  );
}
