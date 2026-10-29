"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { NAV, type PageHref } from "./nav";

// The four pages on phones, fixed to the bottom and clear of the home indicator.
export function TabBar({ current }: { current: PageHref | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-white/[0.08] bg-rail/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {NAV.map(({ href, short, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className="relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted aria-[current=page]:text-foreground"
        >
          {current === href && (
            <ViewTransition name="tab-mark" share="plate" default="none">
              <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-foreground" />
            </ViewTransition>
          )}
          <Icon />
          {short}
        </Link>
      ))}
    </nav>
  );
}
