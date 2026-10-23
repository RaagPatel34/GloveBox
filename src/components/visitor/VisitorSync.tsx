"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useVisitorId } from "./useVisitorId";

// Renders nothing. Makes sure this browser's visitor ID is saved, and if the server rendered
// for a different (or no) ID, such as after cookies were cleared but localStorage survived,
// asks for a fresh render so the right car shows up.
export function VisitorSync({ serverVisitorId }: { serverVisitorId: string | undefined }) {
  const router = useRouter();
  const visitor = useVisitorId();

  useEffect(() => {
    // A brand-new ID has no car yet, so the setup form the server already rendered is right.
    if (visitor !== null && !visitor.isNew && visitor.id !== serverVisitorId) router.refresh();
  }, [visitor, serverVisitorId, router]);

  return null;
}
