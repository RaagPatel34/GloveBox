"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, ViewTransition } from "react";
import { GarageProvider, useGarage } from "@/components/garage/GarageProvider";
import { NAV } from "@/components/shell/nav";
import { Rail } from "@/components/shell/Rail";
import { TabBar } from "@/components/shell/TabBar";
import { legacyHashRoute } from "@/lib/garage-view";

// Every page shares one garage and one shell: the rail (or the phone strip and tab bar)
// stays put while the content area changes.
export default function GarageLayout({ children }: LayoutProps<"/">) {
  const pathname = usePathname();
  const router = useRouter();
  const current = NAV.find((item) => item.href === pathname)?.href ?? null;

  // PR #2 kept its sections behind hashes on the home page; old links land on the page now.
  useEffect(() => {
    if (pathname !== "/") return;
    const route = legacyHashRoute(window.location.hash);
    if (route) router.replace(route);
  }, [pathname, router]);

  return (
    <GarageProvider>
      <div className="app-shell min-h-dvh lg:grid lg:grid-cols-[288px_1fr]">
        <Rail current={current} />
        <main className="mx-auto w-full max-w-5xl pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-28 pl-[max(1rem,env(safe-area-inset-left))] sm:px-8 lg:pt-10 lg:pb-12">
          <StorageError />
          <ViewTransition default="page-swap">{children}</ViewTransition>
        </main>
        <TabBar current={current} />
      </div>
    </GarageProvider>
  );
}

// Storage problems are shown on every page, since every page reads the same garage.
function StorageError() {
  const { storageError } = useGarage();
  if (!storageError) return null;
  return (
    <p role="alert" className="mb-6 rounded-xl bg-overdue/10 px-4 py-3 text-sm text-overdue-text ring-1 ring-overdue/40">
      {storageError}
    </p>
  );
}
