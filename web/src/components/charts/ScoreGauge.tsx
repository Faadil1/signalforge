import { cn } from "@/lib/utils";
import { scoreTextClass } from "@/lib/signal";

export function ScoreGauge({
  score,
  sublabel = "Composite Score",
  size = 200,
}: {
  score?: number;
  sublabel?: string;
  size?: number;
}) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 180;
  const endAngle = 180 + (value / 100) * 180;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--sf-surface-secondary)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--sf-brand)"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
          transform={`rotate(135 ${cx} ${cy})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-mono font-bold tabular-nums", scoreTextClass(score ?? 0))} style={{ fontSize: size * 0.22 }}>
          {(score ?? 0).toFixed(0)}
        </span>
        <span className="mt-1 text-xs text-text-subtle">{sublabel}</span>
      </div>
    </div>
  );
}
