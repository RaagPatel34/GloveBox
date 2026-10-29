"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_COMMAND_LENGTH } from "@/lib/command-limits";
import { commandReply } from "@/lib/command-reply";
import { TripResult } from "@/components/trip-result";
import type { CommandReply, Vehicle } from "@/lib/types";
import { ModelBadge } from "./ModelBadge";

const UNREACHABLE = commandReply(null, "Could not reach GloveBox. Check your connection and try again.");

async function sendCommand(text: string): Promise<CommandReply> {
  try {
    const res = await fetch("/api/cloud-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = (await res.json()) as Partial<CommandReply>;
    return typeof body.message === "string"
      ? commandReply(body.model ?? null, body.message, body.changes, body.proposals, body.trip)
      : UNREACHABLE;
  } catch {
    return UNREACHABLE;
  }
}

// One line to tell GloveBox what happened. A reply that changed the car or added proposal
// cards reloads the dashboard (a server component), so the tiles and cards are current.
// An errand's reply shows the trip plan under the message; it changes nothing, so the
// dashboard stays as it is.
export function CommandBar({ home, mpg }: { home: Vehicle["home"]; mpg: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<CommandReply | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim() === "" || pending) return;
    setPending(true);
    const next = await sendCommand(text);
    setReply(next);
    setPending(false);
    if (next.changes.length > 0 || next.proposals > 0) {
      setText("");
      router.refresh();
    }
  }

  return (
    <section aria-label="Command bar" className="mt-4">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="command" className="sr-only">
          Tell GloveBox what happened
        </label>
        <input
          id="command"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_COMMAND_LENGTH}
          autoComplete="off"
          placeholder="“Just got a car wash” or “camping trip, 300 miles on dirt roads”"
          className="min-w-0 flex-1 rounded-xl bg-panel px-4 py-3 text-base text-foreground ring-1 ring-white/10 placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ok"
        />
        <button
          type="submit"
          disabled={pending || text.trim() === ""}
          className="shrink-0 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
        >
          {pending ? "Working…" : "Send"}
        </button>
      </form>

      <div aria-live="polite">
        {reply && (
          <div className="mt-3 rounded-xl bg-panel px-4 py-3 ring-1 ring-white/5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{reply.message}</p>
              {reply.model && <ModelBadge model={reply.model} />}
            </div>
            {reply.changes.length > 0 && (
              <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
                {reply.changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {reply.trip && <TripResult trip={reply.trip} home={home} mpg={mpg} />}
          </div>
        )}
      </div>
    </section>
  );
}
