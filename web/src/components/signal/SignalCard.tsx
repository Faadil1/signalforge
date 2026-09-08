import { cn } from "@/lib/utils";

type Tone = "positive" | "neutral" | "negative" | "unavailable";

const TONE_BAR: Record<Tone, string> = {
  positive: "bg-positive",
  neutral: "bg-text-secondary",
  negative: "bg-negative",
  unavailable: "bg-text-subtle/40",
};

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
  const tone = available === false ? "unavailable" : signalTone(value);
  const title = name.replace(/_/g, " ");
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{title}</p>
          {direction && (
            <p className={cn("mt-0.5 text-xs font-medium capitalize", TONE_TEXT[tone])}>{direction}</p>
          )}
        </div>
        <div className={cn("font-mono text-lg font-bold tabular-nums", TONE_TEXT[tone])}>
          {value != null ? value.toFixed(0) : "—"}
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
        <div
          className={cn("h-full rounded-full transition-all duration-300", TONE_BAR[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      </div>

      {explanation && <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{explanation}</p>}

      {(confidence != null || weight != null) && (
        <div className="mt-3 flex items-center gap-4 text-xs text-text-subtle">
          {confidence != null && (
            <span>
              Confidence{" "}
              <span className="font-mono tabular-nums text-text-secondary">{(confidence * 100).toFixed(0)}%</span>
            </span>
          )}
          {weight != null && (
            <span>
              Weight <span className="font-mono tabular-nums text-text-secondary">{Math.round(weight * 100)}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
