"use client";

import { useState, type FormEvent } from "react";
import { ModelBadge } from "@/components/command/ModelBadge";
import { ExternalIcon } from "@/components/shell/icons";
import { MAX_TRIP_STOPS } from "@/lib/trip";
import type { TripReply, Vehicle } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const EXAMPLE = "Trader Joe's, Cerritos\nSanta Ana City Hall, 20 Civic Center Plaza, Santa Ana, CA\nKnott's Berry Farm";
const KIND_LABEL = { eia: "EIA regional average", area: "Area average", station: "Station price" } as const;

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
        <button className="text-button" type="button" onClick={() => { setStops(EXAMPLE); setReply(null); }}>
          Use demo stops
        </button>
      </div>
      <p className="helper">
        List the places you need to go. Nemotron looks them up on Google Maps, Google orders the drive from home and back,
        and GloveBox prices the fuel at {mpg} MPG. Your stops are sent to Google.
      </p>
      <form onSubmit={plan}>
        <label>
          Stops, one per line
          <textarea
            value={stops}
            onChange={(event) => { setStops(event.target.value); setReply(null); }}
            required
            rows={4}
            maxLength={MAX_TRIP_STOPS * 201}
            placeholder={"Trader Joe's, Cerritos\n20 Civic Center Plaza, Santa Ana, CA"}
          />
        </label>
        <p className="field-note">Starting from {home.label}. Up to {MAX_TRIP_STOPS} stops.</p>
        <button className="primary" disabled={busy || lines.length === 0}>{busy ? "Planning…" : "Plan trip"}</button>
      </form>

      <div aria-live="polite">
        {reply && !trip && (
          <div className="notice spaced" role="alert">
            {reply.model && <ModelBadge model={reply.model} />}
            <p>{reply.message}</p>
          </div>
        )}
        {trip && (
          <div className="trip-result">
            <ModelBadge model={trip.model} />
            <h3>{money.format(trip.fuelCost)} in fuel for {trip.totalMiles.toFixed(1)} miles</h3>
            <p>From home, {home.label}</p>
            <ol className="location-results list-decimal">
              {trip.stops.map((stop) => (
                <li key={stop.label}>
                  {stop.name && stop.name !== stop.label ? <><strong className="font-medium">{stop.name}</strong> · {stop.label}</> : stop.label}
                </li>
              ))}
            </ol>
            <p className="mt-2.5">Then back home.</p>
            <dl className="calculation-grid">
              <div><dt>Round trip</dt><dd>{trip.totalMiles.toFixed(1)} mi</dd></div>
              <div><dt>Driving time</dt><dd>about {Math.round(trip.totalMinutes)} min</dd></div>
              <div><dt>Gas price</dt><dd>${trip.gasPrice.price.toFixed(3)}/gal</dd></div>
            </dl>
            <p>
              <span className="pill">{KIND_LABEL[trip.gasPrice.kind]}</span>{" "}
              {trip.gasPrice.label ?? "Gas price"}, week of {trip.gasPrice.asOf}.{" "}
              <a href={trip.gasPrice.source} target="_blank" rel="noreferrer">EIA source <ExternalIcon /></a>
            </p>
            {trip.gasPrice.stale && <p className="helper">This price is more than two weeks old; check it before relying on it.</p>}
            <p className="helper">
              Fuel = miles ÷ {mpg} MPG × price per gallon. A regional average, not a station quote. Time excludes traffic and time at stops.
            </p>
            <div className="actions">
              <a className="secondary link-button" href={trip.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps <ExternalIcon /></a>
              <button className="text-button" type="button" onClick={() => onDistance(Number(trip.totalMiles.toFixed(2)))}>
                Use these miles in the detour calculator
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
