"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const FLIP_MS = 560;
const FLIP_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// FLIP: an element that changes place between renders slides from where it was.
// Returns a ref factory: give each element `ref={flip(id)}`.
export function useFlip(): (id: string) => (el: HTMLElement | null) => void {
  const elements = useRef(new Map<string, HTMLElement>());
  const spots = useRef(new Map<string, { x: number; y: number }>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());

  useLayoutEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    elements.current.forEach((el, id) => {
      const before = spots.current.get(id);
      const after = { x: el.offsetLeft, y: el.offsetTop };
      if (before && !still && (before.x !== after.x || before.y !== after.y)) {
        el.animate([{ translate: `${before.x - after.x}px ${before.y - after.y}px` }, { translate: "0 0" }], {
          duration: FLIP_MS,
          easing: FLIP_EASE,
        });
      }
      spots.current.set(id, after);
    });
  });

  return useCallback((id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (el) => {
        if (el) elements.current.set(id, el);
        else {
          elements.current.delete(id);
          spots.current.delete(id);
        }
      };
      refs.current.set(id, ref);
    }
    return ref;
  }, []);
}
