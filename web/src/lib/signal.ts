/**
 * Shared recommendation + score helpers for SignalForge.
 * Centralizes logic that was previously duplicated across pages.
 */

export type Recommendation =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell";

export function formatRecommendation(rec: string): string {
  return (rec || "").replace(/_/g, " ");
}

/** Semantic color for a score value (0-100). Positive = green, negative = red. */
export function scoreTone(score: number): "positive" | "neutral" | "negative" | "strong-negative" {
  if (score >= 75) return "positive";
  if (score >= 60) return "positive";
  if (score >= 40) return "neutral";
  if (score >= 25) return "negative";
  return "strong-negative";
}

/** Tailwind classes for score text, using the new semantic palette. */
export function scoreTextClass(score: number): string {
  switch (scoreTone(score)) {
    case "positive":
      return "text-positive";
    case "neutral":
      return "text-text-secondary";
    case "negative":
      return "text-warning";
    case "strong-negative":
      return "text-negative";
  }
}

/** Tailwind classes for a recommendation pill. */
export function recBadgeClass(rec: string): string {
  switch (rec) {
    case "strong_buy":
      return "bg-positive/10 text-positive ring-1 ring-inset ring-positive/20";
    case "buy":
      return "bg-positive/10 text-positive ring-1 ring-inset ring-positive/20";
    case "hold":
      return "bg-text-secondary/10 text-text-secondary ring-1 ring-inset ring-text-secondary/20";
    case "sell":
      return "bg-warning/10 text-warning ring-1 ring-inset ring-warning/20";
    case "strong_sell":
      return "bg-negative/10 text-negative ring-1 ring-inset ring-negative/20";
    default:
      return "bg-text-secondary/10 text-text-secondary ring-1 ring-inset ring-text-secondary/20";
  }
}
