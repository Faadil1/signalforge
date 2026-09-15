import { cn } from "@/lib/utils";

type Tone = "positive" | "neutral" | "negative" | "unavailable";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  neutral: "text-text-secondary",
  negative: "text-negative",
  unavailable: "text-text-subtle",
};

export function signalTone(value: number | undefined | null): Tone {
  if (value == null) return "unavailable";
  if (value >= 60) return "positive";
  if (value >= 40) return "neutral";
  return "negative";
}

export function SignalCard({
  name,
  value,
  direction,
  explanation,
  confidence,
  weight,
  available,
}: {
  name: string;
  value?: number;
  direction?: string;
  explanation?: string;
  confidence?: number;
  weight?: number;
  available?: boolean;
}) {
  const isUnavailable = available === false;
  const tone = isUnavailable ? "unavailable" : signalTone(value);
  const title = name.replace(/_/g, " ");

  return (
    <div className={cn("border-l-2 border-y border-r border-border bg-surface/70 px-3 py-3", isUnavailable ? "border-l-text-subtle border-dashed" : "border-l-brand")}>
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          <p className="atlas-micro">evidence stratum</p>
          <p className="mt-1 text-sm font-semibold text-text">{title}</p>
          {explanation && <p className="mt-2 text-[12px] leading-5 text-text-secondary">{explanation}</p>}
        </div>
        <div className="text-right">
          <p className={cn("font-mono text-xl font-semibold tabular-nums", TONE_TEXT[tone])}>{isUnavailable ? "—" : value != null ? value.toFixed(0) : "—"}</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-text-subtle">{isUnavailable ? "excluded" : direction || "observed"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className={isUnavailable ? "atlas-stamp atlas-stamp-refused" : "atlas-stamp atlas-stamp-live"}>{isUnavailable ? "NOT USED" : "USED IN FUSION"}</span>
        {!isUnavailable && (
          <div className="flex gap-3 font-mono text-[9px] uppercase tracking-[0.11em] text-text-subtle">
            {confidence != null && <span>conf {Math.round(confidence * 100)}%</span>}
            {weight != null && <span>weight {Math.round(weight * 100)}%</span>}
          </div>
        )}
      </div>
    </div>
  );
}
