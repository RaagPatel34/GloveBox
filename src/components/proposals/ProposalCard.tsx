"use client";

import { useActionState } from "react";
import { decideProposalAction, type ProposalActionState } from "@/app/proposal-actions";
import { ModelBadge } from "@/components/command/ModelBadge";
import type { ProposalCard as Card } from "@/lib/dashboard";

// One suggested schedule change: the item, what moves from and to, why, and which model
// suggested it. Apply moves the item; Dismiss drops the card. An applied card stays,
// marked as applied, with no buttons.
export function ProposalCard({ card }: { card: Card }) {
  const [state, formAction, pending] = useActionState<ProposalActionState, FormData>(decideProposalAction, {});
  const applied = card.state === "applied";

  return (
    <li className={`rounded-2xl bg-panel p-4 ring-1 ${applied ? "ring-white/5" : "ring-white/15"}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug">{card.label}</h3>
        <ModelBadge model={card.model} />
      </div>

      {card.moves.map((move) => (
        <p key={`${move.from}-${move.to}`} className="mt-3 font-mono text-sm tabular-nums">
          <span className="sr-only">Due </span>
          <span className="text-muted line-through decoration-white/30">{move.from}</span>
          <span aria-hidden="true" className="px-2 text-muted">
            →
          </span>
          <span className="sr-only"> moves to </span>
          {move.to}
        </p>
      ))}

      <p className="mt-2 text-sm text-muted">{card.reason}</p>

      {applied ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ok-text">Applied</p>
      ) : (
        <form action={formAction} className="mt-3 flex gap-2">
          <input type="hidden" name="proposalId" value={card.id} />
          <button
            type="submit"
            name="decision"
            value="apply"
            disabled={pending}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
          >
            Apply
          </button>
          <button
            type="submit"
            name="decision"
            value="dismiss"
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-white/20 transition-opacity hover:ring-white/40 disabled:opacity-40"
          >
            Dismiss
          </button>
        </form>
      )}

      {state.message && (
        <p role="alert" className="mt-2 text-sm text-overdue-text">
          {state.message}
        </p>
      )}
    </li>
  );
}
