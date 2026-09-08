import { Badge } from "./Badge";

type Status = "live" | "stale" | "error" | "offline";

const STATUS_CONFIG: Record<Status, { tone: "positive" | "warning" | "negative" | "neutral"; dot: string; label: string }> = {
  live: { tone: "positive", dot: "bg-positive", label: "Live" },
  stale: { tone: "warning", dot: "bg-warning", label: "Stale" },
  error: { tone: "negative", dot: "bg-negative", label: "Error" },
  offline: { tone: "neutral", dot: "bg-text-subtle", label: "Offline" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone}>
      <span className={cnDot(config.dot)} />
      {label ?? config.label}
    </Badge>
  );
}

function cnDot(cls: string) {
  return `h-1.5 w-1.5 rounded-full ${cls}`;
}
