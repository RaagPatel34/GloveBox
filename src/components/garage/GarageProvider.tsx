"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { parseStoredGarage } from "@/lib/garage-storage";
import { demoGarage, isGarage, STORAGE_KEY, type Garage } from "@/lib/maintenance";

// The one garage every page reads: the car saved in this browser.
type GarageContextValue = {
  garage: Garage | null;
  // False until the browser's saved garage has been read. Pages wait for it before
  // choosing between the garage and the empty state.
  ready: boolean;
  // Ticks each minute, and on every save, so estimates and statuses stay current.
  now: Date;
  save(next: Garage, notice?: string): void;
  loadDemo(): void;
  resetDemo(): void;
  undoReset(): void;
  canUndo: boolean;
  message: string;
  storageError: string;
  // The item "Log this service" was pressed on, so the Service log can preselect it.
  logFor: string | null;
  setLogFor(id: string | null): void;
};

const GarageContext = createContext<GarageContextValue | null>(null);

export function useGarage(): GarageContextValue {
  const value = use(GarageContext);
  if (!value) throw new Error("useGarage must be used inside GarageProvider.");
  return value;
}

function write(next: Garage): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function GarageProvider({ children }: { children: ReactNode }) {
  const [garage, setGarage] = useState<Garage | null>(null);
  const [ready, setReady] = useState(false);
  // A fixed placeholder until the load effect reads the clock: reading it during render
  // would bake the prerender's time into the page. Nothing shows `now` before `ready`.
  const [now, setNow] = useState(() => new Date(0));
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  // The garage a reset replaced, kept until the next reset so it can be restored.
  const [beforeReset, setBeforeReset] = useState<Garage | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    const timer = window.setTimeout(() => {
      setNow(new Date());
      try {
        const { garage: saved, error } = parseStoredGarage(localStorage.getItem(STORAGE_KEY));
        if (saved) setGarage(saved);
        if (error) setStorageError(error);
      } catch {
        setStorageError("Browser storage is unavailable or unreadable. You can still try the demo in this tab.");
      }
      setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clock);
    };
  }, []);

  const save = useCallback((next: Garage, notice?: string) => {
    if (!isGarage(next)) {
      setStorageError("That change could not be validated. Your saved garage is unchanged.");
      return;
    }
    if (notice) setMessage(notice);
    setNow(new Date());
    setGarage(next);
    setStorageError(write(next) ? "" : "Your changes work in this tab, but could not be saved for your next visit.");
  }, []);

  const loadDemo = useCallback(() => {
    save(demoGarage(new Date()), "Demo car loaded. Try the dirt-road example below.");
  }, [save]);

  const resetDemo = useCallback(() => {
    setBeforeReset(garage);
    save(demoGarage(new Date()), "Demo car reset. Your earlier records were replaced.");
  }, [garage, save]);

  const undoReset = useCallback(() => {
    if (!beforeReset) return;
    save(beforeReset, "Restored your earlier records.");
    setBeforeReset(null);
  }, [beforeReset, save]);

  const value = useMemo<GarageContextValue>(
    () => ({
      garage,
      ready,
      now,
      save,
      loadDemo,
      resetDemo,
      undoReset,
      canUndo: beforeReset !== null,
      message,
      storageError,
      logFor,
      setLogFor,
    }),
    [garage, ready, now, save, loadDemo, resetDemo, undoReset, beforeReset, message, storageError, logFor],
  );

  return <GarageContext value={value}>{children}</GarageContext>;
}
