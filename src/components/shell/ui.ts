// Shared class strings for the new pages, written out in full so Tailwind can see them.
export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-white disabled:opacity-40";
export const quietButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ring-1 ring-white/15 transition-colors hover:bg-white/[0.05] hover:ring-white/30 disabled:opacity-40";
// Field edges hold 3:1 against the panel (white/35); placeholders use the full muted token.
export const fieldClass =
  "block w-full rounded-lg bg-black/40 px-3 py-2.5 text-base ring-1 ring-white/35 placeholder:text-muted focus:ring-white/60";
export const panelClass = "rounded-2xl bg-panel p-5 ring-1 ring-white/5 sm:p-6";
