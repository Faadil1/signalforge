import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AtlasTone = "default" | "live" | "warning" | "critical" | "quiet";

type AtlasPanelProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  code?: string;
  meta?: ReactNode;
  tone?: AtlasTone;
  children: ReactNode;
};

const TONE: Record<AtlasTone, string> = {
  default: "atlas-panel-default",
  live: "atlas-panel-live",
  warning: "atlas-panel-warning",
  critical: "atlas-panel-critical",
  quiet: "atlas-panel-quiet",
};

export function AtlasPanel({
  label,
  code,
  meta,
  tone = "default",
  className,
  children,
  ...props
}: AtlasPanelProps) {
  return (
    <section className={cn("atlas-panel", TONE[tone], className)} {...props}>
      {(label || code || meta) && (
        <div className="atlas-panel-rail">
          <div className="flex min-w-0 items-center gap-2">
            {code && <span className="atlas-code">{code}</span>}
            {label && <span className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</span>}
          </div>
          {meta && <div className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-text-subtle">{meta}</div>}
        </div>
      )}
      <div className="atlas-panel-body">{children}</div>
    </section>
  );
}
