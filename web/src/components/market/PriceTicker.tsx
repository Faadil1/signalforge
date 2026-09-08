import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Format a price with sensible precision based on magnitude
 * (BTC/ETH get 2 decimals, sub-dollar coins get 4-6).
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || !Number.isFinite(price)) return "—";
  const decimals = price >= 100 ? 2 : price >= 1 ? 4 : 6;
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Live price + 24h change badge. Green/red with an up/down arrow when the
 * market is moving, neutral/gray when flat.
 */
export function PriceTicker({
  price,
  changePct,
  showChange = true,
  className,
}: {
  price?: number;
  changePct?: number;
  showChange?: boolean;
  className?: string;
}) {
  const up = changePct !== undefined && changePct > 0.001;
  const down = changePct !== undefined && changePct < -0.001;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono tabular-nums", className)}>
      <span>{formatPrice(price)}</span>
      {showChange && changePct !== undefined && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-xs tabular-nums",
            up ? "text-positive" : down ? "text-negative" : "text-text-subtle"
          )}
        >
          {up ? (
            <TrendingUp className="h-3 w-3" />
          ) : down ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {up ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      )}
    </span>
  );
}