"use client";

import { useActionState } from "react";
import { loadDemoCarAction, type DemoCarState } from "@/app/demo-actions";
import { useVisitorId } from "@/components/visitor/useVisitorId";

// One click replaces the visitor's car with the demo car. Used on the setup screen and
// at the foot of the dashboard, so it can be clicked again to reset.
export function LoadDemoCarButton({ className }: { className: string }) {
  const visitor = useVisitorId();
  const [state, formAction, pending] = useActionState<DemoCarState, FormData>(loadDemoCarAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="visitorId" value={visitor?.id ?? ""} />
      <button type="submit" disabled={pending || visitor === null} className={className}>
        {pending ? "Loading demo car…" : "Load demo car"}
      </button>
      {state.message && (
        <p role="alert" className="mt-2 text-sm text-overdue-text">
          {state.message}
        </p>
      )}
    </form>
  );
}
