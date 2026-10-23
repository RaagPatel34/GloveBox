"use client";

// PROTOTYPE: floating variant switcher. Never rendered in production builds.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = { variants: { key: string; name: string }[]; current: string };

export function PrototypeSwitcher({ variants, current }: Props) {
  const router = useRouter();
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length];
    router.replace(`?variant=${next.key}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  const v = variants[index];
  return (
    <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full bg-fuchsia-600 p-1 text-sm text-white shadow-lg shadow-black/30">
        <button onClick={() => go(-1)} className="size-9 rounded-full hover:bg-white/15" aria-label="Previous variant">
          ←
        </button>
        <span className="px-2 font-mono tabular-nums">
          {v.key} <span className="opacity-80">({v.name})</span>
        </span>
        <button onClick={() => go(1)} className="size-9 rounded-full hover:bg-white/15" aria-label="Next variant">
          →
        </button>
      </div>
    </div>
  );
}
