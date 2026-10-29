import type { CSSProperties } from "react";
import { wheelPlan } from "@/lib/garage-view";

// A readout set in drum wheels, like an odometer. Each wheel always renders at its real
// value; the CSS in globals.css decides whether it rolls there (see "Motion").
// The visible digits are aria-hidden, so callers give the readout its accessible text.
export function RollingNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex ${className}`}>
      {wheelPlan(value).map((entry, index) =>
        entry.kind === "sep" ? (
          <span key={index}>{entry.char}</span>
        ) : (
          <Wheel key={index} digit={entry.digit} turns={entry.turns} />
        ),
      )}
    </span>
  );
}

// One drum. The strip repeats 0-9 once per extra turn, so the ones wheel can spin past
// its value on ignition the way a real odometer's rightmost wheel moves most.
export function Wheel({ digit, turns }: { digit: number; turns: number }) {
  return (
    <span className="wheel">
      <span className="wheel-strip" style={{ "--wheel-to": `-${digit + 10 * turns}em` } as CSSProperties}>
        {Array.from({ length: 10 * (turns + 1) }, (_, index) => (
          <span key={index}>{index % 10}</span>
        ))}
      </span>
    </span>
  );
}

// Only whole numbers roll; "Today" and "—" are printed as they are.
export const isRollable = (value: string) => /^[\d,]+$/.test(value);
