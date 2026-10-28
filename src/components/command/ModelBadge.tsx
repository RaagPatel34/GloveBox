import type { ModelTier } from "@/lib/types";

const MODEL_LABEL: Record<ModelTier, string> = { nano: "Nano", super: "Super", ultra: "Ultra" };

// Which Nemotron model wrote an AI response. Shown on every one (command replies, and
// later proposal cards and trip plans), so the routing is visible.
export function ModelBadge({ model }: { model: ModelTier | "sample" }) {
  if (model === "sample") return <span className="text-xs text-muted">Sample · not AI-generated</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted ring-1 ring-white/15">
      <span className="sr-only">Answered by </span>
      Nemotron <span className="text-foreground">{MODEL_LABEL[model]}</span>
    </span>
  );
}
