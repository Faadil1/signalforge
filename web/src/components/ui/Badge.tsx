import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "positive" | "negative" | "warning" | "info" | "neutral" | "brand";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand ring-1 ring-inset ring-brand/20",
  positive: "bg-positive/10 text-positive ring-1 ring-inset ring-positive/20",
  negative: "bg-negative/10 text-negative ring-1 ring-inset ring-negative/20",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/20",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
  neutral: "bg-text-secondary/10 text-text-secondary ring-1 ring-inset ring-text-secondary/20",
};

export function Badge({ className, tone = "brand", ...props }: BadgeProps) {
  return <span className={cn("chip", TONE[tone], className)} {...props} />;
}
