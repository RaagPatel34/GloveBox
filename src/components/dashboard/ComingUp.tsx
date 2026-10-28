"use client";

import { useFlip } from "@/components/motion/useFlip";
import type { DashboardItem } from "@/lib/dashboard";
import { Tile } from "./Tile";

// Everything after the next item, soonest first. A tile that changes rank slides to its new place.
export function ComingUp({ items, changed, onSeen }: { items: DashboardItem[]; changed: string[]; onSeen: (id: string) => void }) {
  const flip = useFlip();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="coming-up-h">
      <h2 id="coming-up-h" className="text-lg font-medium">
        Coming up <span className="text-sm font-normal text-muted">· soonest first</span>
      </h2>
      {/* Positioned, so FLIP measures each tile within the grid and only a re-ranked tile slides. */}
      <ul className="relative mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Tile key={item.id} item={item} changed={changed.includes(item.id)} onSeen={() => onSeen(item.id)} flipRef={flip(item.id)} />
        ))}
      </ul>
    </section>
  );
}
