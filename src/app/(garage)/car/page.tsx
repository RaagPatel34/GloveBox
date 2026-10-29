"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackupRestore, CarSetup, IntervalEditor, SourceLibrary } from "@/components/garage-tools";
import { GarageTransfer } from "@/components/garage-transfer";
import { useGarage } from "@/components/garage/GarageProvider";
import { panelClass, primaryButton, quietButton } from "@/components/shell/ui";
import { numberFormat } from "@/lib/readout";

const READY_NOTICE = "Your car is ready. Add your service history in the Service log.";

// How is this set up? The car, its intervals and sources, backups, the cloud copy and AI status.
export default function CarPage() {
  const { garage, ready, save, loadDemo, resetDemo, undoReset, canUndo, message } = useGarage();
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setLiveAvailable(Boolean(data.liveAI)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!ready) return <p className="py-16 text-center text-muted">Opening your garage…</p>;

  // "Add my car" lands here, so with no car this page is the setup form, with the demo one tap away.
  if (!garage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium tracking-tight">Add your car</h1>
        <p className="text-muted">
          Or{" "}
          <button type="button" onClick={loadDemo} className="text-foreground underline underline-offset-4">
            load the demo car
          </button>{" "}
          to look around first.
        </p>
        <CarSetup existing={false} onCancel={() => router.push("/")} onSave={(next) => save(next, READY_NOTICE)} />
      </div>
    );
  }

  const { vehicle } = garage;
  const mpgSource = vehicle.mpgSource?.kind === "epa" ? "EPA estimate" : vehicle.isDemo ? "Illustrative" : "Your estimate";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">Car &amp; settings</h1>

      <section aria-labelledby="car-facts-h" className="tool-panel">
        <div className="section-heading">
          <h2 id="car-facts-h">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h2>
          <span className="tiny">{vehicle.isDemo ? "Demo vehicle" : "Your vehicle"}</span>
        </div>
        <dl className="calculation-grid">
          <div>
            <dt>Recorded odometer</dt>
            <dd>{numberFormat.format(vehicle.odometer)} mi</dd>
          </div>
          <div>
            <dt>Fuel economy</dt>
            <dd>
              {vehicle.mpgOverride || vehicle.epaMpg} MPG <span className="tiny font-sans">· {mpgSource}</span>
            </dd>
          </div>
          <div>
            <dt>Weekly driving</dt>
            <dd>{numberFormat.format(vehicle.weeklyMiles)} mi</dd>
          </div>
          <div>
            <dt>Home</dt>
            <dd className="font-sans text-sm">{vehicle.home.label}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSetupOpen(true)} className={quietButton}>
            Replace car
          </button>
          <button type="button" onClick={resetDemo} className={quietButton}>
            Reset demo car
          </button>
        </div>
        <div className="mt-3 flex min-h-6 flex-wrap items-center gap-3 text-sm">
          <p role="status">{message}</p>
          {canUndo && (
            <button type="button" onClick={undoReset} className={primaryButton}>
              Undo
            </button>
          )}
        </div>
      </section>

      {setupOpen && (
        <CarSetup
          existing
          onCancel={() => setSetupOpen(false)}
          onSave={(next) => {
            save(next, READY_NOTICE);
            setSetupOpen(false);
          }}
        />
      )}

      <IntervalEditor key={vehicle.id} garage={garage} onSave={(next) => save(next)} />
      <SourceLibrary garage={garage} />
      <BackupRestore garage={garage} onSave={save} />
      <div className={panelClass}>
        <GarageTransfer garage={garage} />
      </div>

      <section aria-labelledby="about-h" className="tool-panel">
        <h2 id="about-h">About this garage</h2>
        <p className="helper">
          Your records are saved in this browser. Export a backup to keep a copy.{" "}
          {liveAvailable === null ? "Checking live AI…" : `Live AI is currently ${liveAvailable ? "available" : "paused"}.`} Sample
          suggestions are labeled and always wait for your approval.
        </p>
        <h3>Cloud garage</h3>
        <p className="helper">
          The cloud garage is separate from your local records and requires a database connection. Opening it does not upload or
          replace your saved car.
        </p>
        <Link className={quietButton} href="/garage">
          Open cloud garage
        </Link>
      </section>
    </div>
  );
}
