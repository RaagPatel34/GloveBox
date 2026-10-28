import type { DashboardItem } from "@/lib/dashboard";
import { Tile } from "./Tile";

// Everything after the next item, soonest first.
export function ComingUp({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="coming-up-h">
      <h2 id="coming-up-h" className="text-lg font-medium">
        Coming up <span className="text-sm font-normal text-muted">· soonest first</span>
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
