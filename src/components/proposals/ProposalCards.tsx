import type { ProposalCard as Card } from "@/lib/dashboard";
import { ProposalCard } from "./ProposalCard";

// The schedule changes suggested for life events, between the command bar and the tiles.
// Nothing is shown until there is a suggestion.
export function ProposalCards({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="Suggested schedule changes" className="mt-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Suggested changes</h2>
      <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <ProposalCard key={card.id} card={card} />
        ))}
      </ul>
    </section>
  );
}
