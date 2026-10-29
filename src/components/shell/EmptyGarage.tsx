"use client";

import Link from "next/link";
import { useGarage } from "@/components/garage/GarageProvider";
import { ArrowIcon } from "./icons";
import { primaryButton, quietButton } from "./ui";

// Every page shows this until there is a car: the same two ways in, wherever you land.
export function EmptyGarage() {
  const { ready, loadDemo } = useGarage();
  if (!ready) return <p className="py-16 text-center text-muted">Opening your garage…</p>;
  return (
    <section aria-labelledby="empty-h" className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <CarArt />
      <h1 id="empty-h" className="mt-8 text-3xl font-medium tracking-tight">Meet your next co-pilot.</h1>
      <p className="mt-3 text-muted">
        Try a sample Civic with a few things on its to-do list. No account or API key needed for sample mode.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={loadDemo} className={primaryButton}>
          Load demo car <ArrowIcon />
        </button>
        <Link href="/car" className={quietButton}>
          Add my car
        </Link>
      </div>
    </section>
  );
}

function CarArt() {
  return (
    <svg viewBox="0 0 500 200" fill="none" aria-hidden className="w-full max-w-xs text-muted">
      <path d="M58 129 70 100l67-12 53-46h119l62 48 65 18 14 30-8 21H59l-9-15Z" className="fill-panel" stroke="currentColor" strokeWidth="3" />
      <path d="m153 89 45-37h49v37Zm106-37h43l45 37h-88Z" className="fill-white/[0.06]" />
      <path d="M63 118h47m287-2 35 8M248 94v50m-58-43h22m57 0h22" stroke="currentColor" strokeWidth="3" />
      <circle cx="131" cy="151" r="30" className="fill-background" stroke="currentColor" strokeWidth="3" />
      <circle cx="131" cy="151" r="12" fill="currentColor" />
      <circle cx="371" cy="151" r="30" className="fill-background" stroke="currentColor" strokeWidth="3" />
      <circle cx="371" cy="151" r="12" fill="currentColor" />
      <path d="M49 184h405" stroke="currentColor" strokeOpacity=".4" strokeWidth="2" />
    </svg>
  );
}
