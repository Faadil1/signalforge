import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 border-b border-border pb-5 sm:grid-cols-[1fr_auto] sm:items-end", className)}>
      <div>
        <p className="field-label">SIGNALFORGE / ANALYSIS SURFACE</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-text md:text-4xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
