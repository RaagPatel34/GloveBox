"use client";

import { useState, type FormEvent } from "react";
import { ModelBadge } from "@/components/command/ModelBadge";
import { TripResult } from "@/components/trip-result";
import { MAX_TRIP_STOPS } from "@/lib/trip";
import type { TripReply, Vehicle } from "@/lib/types";

const EXAMPLE = "Trader Joe's, Cerritos\nSanta Ana City Hall, 20 Civic Center Plaza, Santa Ana, CA\nKnott's Berry Farm";

// The trip agent: type the stops, Nemotron Super looks them up, Google orders the drive
// from home and back, and code prices the fuel from the car's MPG and the EIA weekly price.
export function TripAgent({ home, mpg, onDistance }: { home: Vehicle["home"]; mpg: number; onDistance: (miles: number) => void }) {
  const [stops, setStops] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<TripReply | null>(null);
  const lines = stops.split("\n").map((line) => line.trim()).filter(Boolean);

  async function plan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setReply(null);
    try {
      const response = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: lines, home, mpg }),
      });
      setReply(await response.json());
    } catch {
      setReply({ model: null, message: "Could not reach GloveBox just now. Please try again, or plan the drive by hand below.", plan: null });
    } finally {
      setBusy(false);
    }
  }

  const trip = reply?.plan;
  return (
    <section className="tool-panel" aria-label="Plan errands">
      <div className="section-heading">
        <h2>Plan your errands</h2>
        <button className="text-button" type="button" disabled={busy} onClick={() => { setStops(EXAMPLE); setReply(null); }}>
          Use demo stops
        </button>
      </div>
      <p className="helper">
        List the places you need to go. Nemotron looks them up on Google Maps, Google orders the drive from home and back,
        and GloveBox prices the fuel at <span className="font-mono tabular-nums">{mpg}</span> MPG. Your stops are sent to Google.
      </p>
      <form onSubmit={plan}>
        <label>
          Stops, one per line
          <textarea
            value={stops}
            onChange={(event) => { setStops(event.target.value); setReply(null); }}
            disabled={busy}
            required
            rows={4}
            maxLength={MAX_TRIP_STOPS * 201}
            placeholder={"Trader Joe's, Cerritos\n20 Civic Center Plaza, Santa Ana, CA"}
          />
        </label>
        <p className="field-note">Starting from {home.label}. Up to <span className="font-mono tabular-nums">{MAX_TRIP_STOPS}</span> stops.</p>
        <button className="primary" disabled={busy || lines.length === 0}>{busy ? "Planning…" : "Plan trip"}</button>
      </form>

      <div aria-live="polite">
        {reply && !trip && (
          <div className="notice spaced" role="alert">
            {reply.model && <ModelBadge model={reply.model} />}
            <p>{reply.message}</p>
          </div>
        )}
        {trip && <TripResult trip={trip} home={home} mpg={mpg} onDistance={onDistance} />}
      </div>
    </section>
  );
}
