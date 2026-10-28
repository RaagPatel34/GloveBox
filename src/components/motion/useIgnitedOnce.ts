"use client";

import { useEffect } from "react";

export const IGNITION_MS = 1100;

// Once per visit the gauges sweep up from zero. Until <html data-ignited> is set, the CSS
// gives wheels and meters a zero starting style and the long ignition duration; after it,
// they only roll between real values. Set once, so returning to a page never replays it.
let scheduled = false;

export function useIgnitedOnce(active: boolean) {
  useEffect(() => {
    if (!active || scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      document.documentElement.dataset.ignited = "";
    }, IGNITION_MS);
  }, [active]);
}
