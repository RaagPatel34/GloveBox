"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveCarAction, type SetupState } from "@/app/setup-actions";
import { LoadDemoCarButton } from "@/components/demo/LoadDemoCarButton";
import { useVisitorId } from "@/components/visitor/useVisitorId";
import { EPA_UNREACHABLE, type EpaVehicle, type MenuItem } from "@/lib/epa";

type Selection = { year: string; make: string; model: string; optionId: string };
const EMPTY: Selection = { year: "", make: "", model: "", optionId: "" };

async function getJson<T>(query: string): Promise<T> {
  const res = await fetch(`/api/epa${query}`);
  if (!res.ok) throw new Error("lookup failed");
  return (await res.json()) as T;
}

const fieldClass =
  "mt-1.5 w-full rounded-lg bg-black/50 px-3 py-2.5 text-base text-foreground ring-1 ring-white/10 " +
  "placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ok disabled:opacity-50";
const labelClass = "block font-mono text-[11px] uppercase tracking-[0.14em] text-muted";

export function SetupForm() {
  const visitor = useVisitorId();
  const [state, formAction, pending] = useActionState<SetupState, FormData>(saveCarAction, {});

  const [selection, setSelection] = useState<Selection>(EMPTY);
  const [years, setYears] = useState<MenuItem[]>([]);
  const [makes, setMakes] = useState<MenuItem[]>([]);
  const [models, setModels] = useState<MenuItem[]>([]);
  const [options, setOptions] = useState<MenuItem[]>([]);
  const [epaVehicle, setEpaVehicle] = useState<EpaVehicle | null>(null);
  // Controlled, because React clears uncontrolled fields after every submit, including failed ones.
  const [typed, setTyped] = useState({ mpgOverride: "", odometer: "", weeklyMiles: "250", home: "" });
  const fieldProps = (name: keyof typeof typed) => ({
    name,
    value: typed[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTyped((current) => ({ ...current, [name]: e.target.value })),
  });
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Latest lookup wins: a slow earlier response must not overwrite a newer choice.
  const latestLookup = useRef(0);

  async function lookup<T>(query: string, apply: (data: T) => void) {
    const thisLookup = ++latestLookup.current;
    setLookupError(null);
    try {
      const data = await getJson<T>(query);
      if (thisLookup === latestLookup.current) apply(data);
    } catch {
      if (thisLookup === latestLookup.current) setLookupError(`${EPA_UNREACHABLE} Try again in a moment.`);
    }
  }

  useEffect(() => {
    let live = true;
    getJson<{ items: MenuItem[] }>("")
      .then((data) => live && setYears(data.items))
      .catch(() => live && setLookupError(`${EPA_UNREACHABLE} Reload to try again.`));
    return () => {
      live = false;
    };
  }, []);

  function chooseYear(year: string) {
    setSelection({ ...EMPTY, year });
    setMakes([]);
    setModels([]);
    setOptions([]);
    setEpaVehicle(null);
    if (year) void lookup<{ items: MenuItem[] }>(`?year=${year}`, (menu) => setMakes(menu.items));
  }

  function chooseMake(make: string) {
    setSelection({ ...EMPTY, year: selection.year, make });
    setModels([]);
    setOptions([]);
    setEpaVehicle(null);
    if (make) {
      void lookup<{ items: MenuItem[] }>(`?year=${selection.year}&make=${encodeURIComponent(make)}`, (menu) => setModels(menu.items));
    }
  }

  function chooseModel(model: string) {
    setSelection({ ...EMPTY, year: selection.year, make: selection.make, model });
    setOptions([]);
    setEpaVehicle(null);
    if (model) {
      const query = `?year=${selection.year}&make=${encodeURIComponent(selection.make)}&model=${encodeURIComponent(model)}`;
      void lookup<{ items: MenuItem[] }>(query, (menu) => {
        setOptions(menu.items);
        // A model with a single option needs no second choice.
        if (menu.items.length === 1) chooseOption(menu.items[0].value, { ...selection, model });
      });
    }
  }

  function chooseOption(optionId: string, base: Selection = selection) {
    setSelection({ ...base, optionId });
    setEpaVehicle(null);
    if (optionId) void lookup<{ vehicle: EpaVehicle }>(`?vehicleId=${optionId}`, (data) => setEpaVehicle(data.vehicle));
  }

  const errors = state.errors ?? {};
  const fieldError = (name: keyof typeof errors) =>
    errors[name] ? (
      <p role="alert" className="mt-1.5 text-sm text-overdue-text">
        {errors[name]}
      </p>
    ) : null;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">GloveBox</p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Set up your car</h1>
      <p className="mt-2 text-muted">
        Pick your car and GloveBox builds its upkeep schedule. No account needed: your car is saved to this browser.
      </p>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-panel p-5 ring-1 ring-white/5">
        <p className="min-w-0 flex-1 basis-56 text-sm text-muted">
          <span className="font-semibold text-foreground">Just looking?</span> Try a 2019 Honda Civic that already has
          upkeep due.
        </p>
        <LoadDemoCarButton className="rounded-xl bg-ok px-5 py-3 text-base font-semibold text-black transition-opacity disabled:opacity-40" />
      </section>

      <form action={formAction} className="mt-6 grid gap-5 rounded-2xl bg-panel p-5 ring-1 ring-white/5 sm:p-8">
        <input type="hidden" name="visitorId" value={visitor?.id ?? ""} />
        <input type="hidden" name="epaVehicleId" value={selection.optionId} />

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Year
            <select className={fieldClass} value={selection.year} onChange={(e) => chooseYear(e.target.value)} required>
              <option value="">Select…</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.text}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Make
            <select
              className={fieldClass}
              value={selection.make}
              onChange={(e) => chooseMake(e.target.value)}
              disabled={makes.length === 0}
              required
            >
              <option value="">Select…</option>
              {makes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.text}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Model
          <select
            className={fieldClass}
            value={selection.model}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={models.length === 0}
            required
          >
            <option value="">Select…</option>
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.text}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Engine and transmission
          <select
            className={fieldClass}
            value={selection.optionId}
            onChange={(e) => chooseOption(e.target.value)}
            disabled={options.length === 0}
            required
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.text}
              </option>
            ))}
          </select>
          {fieldError("epaVehicleId")}
        </label>

        {lookupError && (
          <p role="alert" className="text-sm text-overdue-text">
            {lookupError}
          </p>
        )}

        <p aria-live="polite" className="rounded-xl bg-black/40 px-4 py-3 font-mono text-sm ring-1 ring-white/5">
          {epaVehicle ? (
            <>
              <span className="tabular-nums text-ok-text">{epaVehicle.combinedMpg} MPG</span>
              <span className="text-muted"> combined (EPA, fueleconomy.gov)</span>
            </>
          ) : (
            <span className="text-muted">EPA MPG appears once you pick your car.</span>
          )}
        </p>

        <label className={labelClass}>
          MPG override <span className="normal-case tracking-normal">(optional)</span>
          <input {...fieldProps("mpgOverride")} inputMode="decimal" placeholder={epaVehicle ? String(epaVehicle.combinedMpg) : "Your real-world MPG"} className={fieldClass} />
          {fieldError("mpgOverride")}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Odometer (mi)
            <input {...fieldProps("odometer")} inputMode="numeric" placeholder="48,000" required className={fieldClass} />
            {fieldError("odometer")}
          </label>
          <label className={labelClass}>
            Miles per week
            <input {...fieldProps("weeklyMiles")} inputMode="numeric" required className={fieldClass} />
            {fieldError("weeklyMiles")}
          </label>
        </div>

        <label className={labelClass}>
          Home
          <input {...fieldProps("home")} placeholder="City, state, ZIP or landmark" autoComplete="off" required className={fieldClass} />
          <span className="mt-1.5 block normal-case tracking-normal text-muted">
            A city or ZIP is plenty. It is only used to find nearby gas and weather.
          </span>
          {fieldError("home")}
        </label>

        {state.message && (
          <p role="alert" className="text-sm text-overdue-text">
            {state.message}
          </p>
        )}
        {fieldError("visitorId")}

        <button
          type="submit"
          disabled={pending || visitor === null || epaVehicle === null}
          className="rounded-xl bg-ok px-5 py-3 text-base font-semibold text-black transition-opacity disabled:opacity-40"
        >
          {pending ? "Building your schedule…" : "Save car and open dashboard"}
        </button>
      </form>
    </main>
  );
}
