"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { garageSaved, garageUpdated, resetToDemo, undoReset as undone, type GarageSession } from "@/lib/garage-session";
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
  // Apply a change to the garage as it is when the change lands, for work that finishes
  // later than it started (a live drive review, a card that resolves after its exit).
  update(change: (garage: Garage) => Garage, notice?: string): void;
  loadDemo(): void;
  resetDemo(): void;
  undoReset(): void;
  // True from a reset until anything else is saved.
  canUndo: boolean;
  // Garage-wide notices (demo loaded, reset, undo, car or backup replaced). Each tool shows its own result.
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
  // The latest session, read and written by every handler, so a change never acts on a
  // garage that a later change has already replaced. State mirrors it for rendering.
  const session = useRef<GarageSession>({ garage: null, beforeReset: null });
  const [garage, setGarage] = useState<Garage | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [ready, setReady] = useState(false);
  // A fixed placeholder until the load effect reads the clock: reading it during render
  // would bake the prerender's time into the page. Nothing shows `now` before `ready`.
  const [now, setNow] = useState(() => new Date(0));
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [logFor, setLogFor] = useState<string | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    const timer = window.setTimeout(() => {
      setNow(new Date());
      try {
        const { garage: saved, error } = parseStoredGarage(localStorage.getItem(STORAGE_KEY));
        if (saved) {
          session.current = { garage: saved, beforeReset: null };
          setGarage(saved);
        }
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

  const commit = useCallback((next: GarageSession, notice?: string) => {
    if (next === session.current || !next.garage) return;
    if (!isGarage(next.garage)) {
      setStorageError("That change could not be validated. Your saved garage is unchanged.");
      return;
    }
    session.current = next;
    setGarage(next.garage);
    setCanUndo(next.beforeReset !== null);
    if (notice) setMessage(notice);
    setNow(new Date());
    setStorageError(write(next.garage) ? "" : "Your changes work in this tab, but could not be saved for your next visit.");
  }, []);

  const save = useCallback((next: Garage, notice?: string) => commit(garageSaved(session.current, next), notice), [commit]);

  const update = useCallback(
    (change: (garage: Garage) => Garage, notice?: string) => commit(garageUpdated(session.current, change), notice),
    [commit],
  );

  const loadDemo = useCallback(() => {
    save(demoGarage(new Date()), "Demo car loaded. Try the dirt-road example below.");
  }, [save]);

  const resetDemo = useCallback(() => {
    commit(resetToDemo(session.current, demoGarage(new Date())), "Demo car reset. Your earlier records were replaced.");
  }, [commit]);

  const undoReset = useCallback(() => {
    commit(undone(session.current), "Restored your earlier records.");
  }, [commit]);

  const value = useMemo<GarageContextValue>(
    () => ({
      garage,
      ready,
      now,
      save,
      update,
      loadDemo,
      resetDemo,
      undoReset,
      canUndo,
      message,
      storageError,
      logFor,
      setLogFor,
    }),
    [garage, ready, now, save, update, loadDemo, resetDemo, undoReset, canUndo, message, storageError, logFor],
  );

  return <GarageContext value={value}>{children}</GarageContext>;
}
