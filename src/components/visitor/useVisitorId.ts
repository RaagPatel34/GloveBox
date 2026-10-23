"use client";

import { useSyncExternalStore } from "react";
import {
  resolveVisitorId,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  VISITOR_STORAGE_KEY,
} from "@/lib/visitor";

export type Visitor = { id: string; isNew: boolean };

function readCookie(): string | undefined {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${VISITOR_COOKIE}=`));
  return match?.slice(VISITOR_COOKIE.length + 1);
}

// Worked out once per page load, on first read in the browser. Reading it also makes sure both
// stores hold the ID (idempotent), which is why this is a snapshot of the browser's storage
// rather than component state.
let cached: Visitor | null = null;

function readVisitor(): Visitor {
  if (cached) return cached;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VISITOR_STORAGE_KEY);
  } catch {
    // Storage blocked: fall back to the cookie alone.
  }
  const resolved = resolveVisitorId({ stored, cookie: readCookie(), generate: () => crypto.randomUUID() });
  if (resolved.saveToStorage) {
    try {
      localStorage.setItem(VISITOR_STORAGE_KEY, resolved.id);
    } catch {
      // See above.
    }
  }
  if (resolved.saveToCookie) {
    document.cookie = `${VISITOR_COOKIE}=${resolved.id}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  }
  cached = { id: resolved.id, isNew: resolved.saveToStorage && resolved.saveToCookie };
  return cached;
}

const subscribe = () => () => {};
const readOnServer = () => null;

// This browser's anonymous visitor ID: kept in localStorage, mirrored to a cookie so the
// server can find the right car. Null during server rendering and hydration.
// isNew means the ID was just made, so no car can exist for it yet.
export function useVisitorId(): Visitor | null {
  return useSyncExternalStore(subscribe, readVisitor, readOnServer);
}
