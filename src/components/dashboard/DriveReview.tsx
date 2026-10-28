"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ModelBadge } from "@/components/command/ModelBadge";
import { useGarage } from "@/components/garage/GarageProvider";
import { fieldClass, primaryButton, quietButton } from "@/components/shell/ui";
import type { ProposalCard } from "@/lib/dashboard";
import { addProposals, isGarage, resolveProposal, sampleCommand, type CommandResult } from "@/lib/maintenance";
import type { Proposal } from "@/lib/types";

const EXAMPLE = "I drove 300 miles on dirt roads";

type Reply = { text: string; model: Proposal["model"] | null };

// Tell GloveBox about a drive; it suggests schedule changes, and nothing changes until you apply one.
export function DriveReview({ proposals }: { proposals: ProposalCard[] }) {
  const { garage, save, message } = useGarage();
  const [command, setCommand] = useState("");
  const [mode, setMode] = useState<"sample" | "live">("sample");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");
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
    try {
      let data: CommandResult;
      if (mode === "sample") data = sampleCommand(command, garage);
      else {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, mode, garage: { ...garage, proposals: [], services: [] } }),
          signal: AbortSignal.timeout(30000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The request failed. Please try again.");
        data = result as CommandResult;
      }
      const next = addProposals(garage, data.proposals);
      if (!isGarage(next)) throw new Error("The response was invalid. Your schedule is unchanged.");
      save(next);
      setReply({ text: data.message, model: data.source === "sample" ? "sample" : "super" });
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

  function resolve(id: string, action: "applied" | "dismissed") {
    if (!garage) return;
    try {
      save(resolveProposal(garage, id, action));
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
          What happened on your last drive?
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
            placeholder="300 miles on dirt roads, a beach weekend…"
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
          <button type="submit" disabled={busy || !command.trim()} className={quietButton}>
            {busy ? "Reviewing…" : "Review drive"}
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
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2 text-sm">
        <p role="status" className="reply-line">
          {statusText}
        </p>
        {!busy && reply?.model && <ModelBadge model={reply.model} />}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-overdue-text">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="your-call-h" className="mt-5 border-t border-white/[0.06] pt-5">
          <h2 id="your-call-h" className="font-medium">
            Your call <span className="font-mono text-sm text-muted">{pending.length}</span>{" "}
            <span className="text-sm font-normal text-muted">· nothing changes until you apply</span>
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {pending.map((card) => (
              <article key={card.id} className="rounded-xl bg-black/30 p-4 ring-1 ring-white/10">
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
                  <button type="button" disabled={busy} onClick={() => resolve(card.id, "applied")} className={primaryButton}>
                    Apply
                  </button>
                  <button type="button" disabled={busy} onClick={() => resolve(card.id, "dismissed")} className={quietButton}>
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
