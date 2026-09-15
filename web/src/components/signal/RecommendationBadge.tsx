import { Badge } from "@/components/ui/Badge";
import { formatRecommendation } from "@/lib/signal";

export function RecommendationBadge({ recommendation }: { recommendation?: string | null }) {
  if (!recommendation) return null;
  const tone = recommendation === "insufficient_evidence"
    ? "neutral"
    : recommendation.startsWith("strong_sell")
      ? "negative"
      : recommendation.startsWith("sell")
        ? "warning"
        : recommendation === "hold"
          ? "neutral"
          : "positive";
  return (
    <Badge tone={tone} className="uppercase tracking-wide text-xs">
      {formatRecommendation(recommendation)}
    </Badge>
  );
}
