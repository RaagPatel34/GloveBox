import type { ItemStatus } from "@/lib/types";

// Class names are written out in full so Tailwind can see them.
export const TONE: Record<ItemStatus, { fill: string; text: string; ring: string }> = {
  unknown: { fill: "bg-muted", text: "text-muted", ring: "ring-white/10" },
  overdue: { fill: "bg-overdue", text: "text-overdue-text", ring: "ring-overdue/40" },
  due_soon: { fill: "bg-due-soon", text: "text-due-soon-text", ring: "ring-due-soon/30" },
  ok: { fill: "bg-ok", text: "text-ok-text", ring: "ring-white/10" },
};
