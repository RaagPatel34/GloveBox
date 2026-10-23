import type { Nudge } from "@/lib/types";

// What GloveBox noticed on its own (weather, air quality), each with the reading behind it.
// Renders nothing when there is none: no nudge is a quiet dashboard, not an empty box.
export function NudgeList({ nudges }: { nudges: Nudge[] }) {
  if (nudges.length === 0) return null;

  return (
    <section aria-label="Heads up" className="mt-4">
      <ul className="space-y-2">
        {nudges.map((nudge) => (
          <li key={nudge.id} className="rounded-xl bg-panel px-4 py-3 ring-1 ring-due-soon/30">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-due-soon-text">Heads up · weather &amp; air</p>
            <p className="mt-1.5 text-base">{nudge.text}</p>
            <p className="mt-1 text-sm text-muted">{nudge.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
