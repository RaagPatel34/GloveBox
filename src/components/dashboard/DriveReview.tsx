"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ModelBadge } from "@/components/command/ModelBadge";
import { useGarage } from "@/components/garage/GarageProvider";
import { fieldClass, primaryButton, quietButton } from "@/components/shell/ui";
import { TripResult } from "@/components/trip-result";
import type { ProposalCard } from "@/lib/dashboard";
import { addProposals, isGarage, resolveProposal, sampleCommand, type CommandResult } from "@/lib/maintenance";
import { vehicleMpg } from "@/lib/trip";
import type { Proposal, TripPlan, Vehicle } from "@/lib/types";

const EXAMPLE = "I drove 300 miles on dirt roads";

type Reply = { text: string; model: Proposal["model"] | null; trip?: { plan: TripPlan; home: Vehicle["home"]; mpg: number } };

// A decided card leaves first, then the schedule changes: cause, then effect.
const CARD_EXIT_MS = 150;

// Tell GloveBox about a drive; it suggests schedule changes, and nothing changes until you apply one.
export function DriveReview({
  proposals,
  onReview,
  onApplied,
}: {
  proposals: ProposalCard[];
  // A new review is the next thing you act on, so earlier "Changed" marks have been seen.
  onReview: () => void;
  onApplied: (itemId: string) => void;
}) {
  const { garage, update, message } = useGarage();
  const [command, setCommand] = useState("");
  const [mode, setMode] = useState<"sample" | "live">("sample");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState<string[]>([]);
  const pending = proposals.filter((card) => card.state === "pending");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setLiveAvailable(Boolean(data.liveAI)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!garage || busy || !command.trim()) return;
    setBusy(true);
    setError("");
    setReply(null);
    onReview();
    try {
      let data: CommandResult;
      if (mode === "sample") data = sampleCommand(command, garage);
      else {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, mode, garage: { ...garage, proposals: [], services: [] } }),
          signal: AbortSignal.timeout(120000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The request failed. Please try again.");
        data = result as CommandResult;
      }
      // Added to the garage as it is now: a live review can take seconds, and anything saved
      // meanwhile (a service, the planned-miles slider) must survive it.
      if (data.proposals.length > 0) update((current) => {
        const next = addProposals(current, data.proposals);
        if (!isGarage(next)) throw new Error("The response was invalid. Your schedule is unchanged.");
        return next;
      });
      setReply({
        text: data.message,
        model: data.source === "sample" ? "sample" : (data.tier ?? "super"),
        ...(data.trip ? { trip: { plan: data.trip, home: garage.vehicle.home, mpg: vehicleMpg(garage.vehicle) } } : {}),
      });
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "TimeoutError"
          ? err.message
          : "The request timed out. Your schedule is unchanged. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function decide(id: string, action: "applied" | "dismissed") {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return resolve(id, action);
    setLeaving((ids) => [...ids, id]);
    window.setTimeout(() => {
      resolve(id, action);
      setLeaving((ids) => ids.filter((other) => other !== id));
    }, CARD_EXIT_MS);
  }

  // A card resolves after its exit, so it acts on the garage as it is then, not as it was
  // at the click: two quick decisions would otherwise overwrite each other.
  function resolve(id: string, action: "applied" | "dismissed") {
    try {
      let itemId: string | undefined;
      update((current) => {
        itemId = current.proposals.find((proposal) => proposal.id === id)?.itemId;
        return resolveProposal(current, id, action);
      });
      if (action === "applied" && itemId) onApplied(itemId);
      setReply({
        text:
          action === "applied"
            ? "Reminder updated. No service has been marked complete."
            : "Suggestion dismissed. Your schedule is unchanged.",
        model: null,
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this suggestion.");
    }
  }

  const statusText = busy ? "Checking your drive. Your schedule stays unchanged until you approve." : (reply?.text ?? message);

  return (
    <div className="rounded-2xl bg-panel p-5 ring-1 ring-white/5">
      <form onSubmit={submit}>
        <label htmlFor="drive" className="font-medium">
          Tell GloveBox about a drive or errands
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="drive"
            enterKeyHint="send"
            autoComplete="off"
            maxLength={1000}
            value={command}
            disabled={busy}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="A dusty drive, or gas, car wash and Trader Joe's…"
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
          <button type="submit" disabled={busy || !command.trim()} className={quietButton}>
            {busy ? "Working…" : "Send"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <button type="button" onClick={() => setCommand(EXAMPLE)} disabled={busy} className="text-muted underline-offset-4 hover:text-foreground hover:underline">
            Try: “300 miles on dirt roads”
          </button>
          <label className="flex items-center gap-2 text-muted">
            Mode
            <select
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value as "sample" | "live")}
              className="rounded-lg bg-black/40 px-2 py-1.5 text-base text-foreground ring-1 ring-white/35"
            >
              <option value="sample">Sample · no AI call</option>
              <option value="live" disabled={!liveAvailable}>
                {liveAvailable ? "Live · Nemotron" : "Live AI · paused"}
              </option>
            </select>
          </label>
        </div>
      </form>

      {/* The status region stays mounted and empty, so each new reply is announced. */}
      {/* Collapses while empty; the status region itself stays mounted. */}
      <div className={`flex flex-wrap items-center gap-2 text-sm ${statusText ? "mt-3" : ""}`}>
        <p role="status">
          {statusText && (
            <span key={statusText} className="reply-in">
              {statusText}
            </span>
          )}
        </p>
        {!busy && reply?.model && <ModelBadge model={reply.model} />}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-overdue-text">
          {error}
        </p>
      )}
      {reply?.trip && <TripResult trip={reply.trip.plan} home={reply.trip.home} mpg={reply.trip.mpg} showModel={false} />}

      {pending.length > 0 && (
        <section aria-labelledby="your-call-h" className="mt-5 border-t border-white/[0.06] pt-5">
          <h2 id="your-call-h" className="font-medium">
            Your call <span className="font-mono text-sm text-muted">{pending.length}</span>{" "}
            <span className="text-sm font-normal text-muted">· nothing changes until you apply</span>
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {pending.map((card) => (
              <article
                key={card.id}
                className={`rounded-xl bg-black/30 p-4 ring-1 ring-white/10 transition-[opacity,scale,translate,filter] duration-150 ease-out ${
                  leaving.includes(card.id) ? "-translate-y-3 scale-[0.98] opacity-0 blur-[4px]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">{card.label}</h3>
                  <ModelBadge model={card.model} />
                </div>
                {card.moves.map((move) => (
                  <p key={`${move.from}-${move.to}`} className="mt-2 font-mono text-sm tabular-nums">
                    {move.from === "—" ? <span className="text-muted">No date</span> : <span className="text-muted line-through">{move.from}</span>}
                    {" → "}
                    {move.to}
                  </p>
                ))}
                <p className="mt-2 text-sm text-muted">{card.reason}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy || leaving.includes(card.id)} onClick={() => decide(card.id, "applied")} className={primaryButton}>
                    Apply
                  </button>
                  <button type="button" disabled={busy || leaving.includes(card.id)} onClick={() => decide(card.id, "dismissed")} className={quietButton}>
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
