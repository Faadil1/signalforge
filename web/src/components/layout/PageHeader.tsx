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
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-text md:text-3xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1.5 text-[15px] text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 sm:mt-1">{actions}</div>}
    </div>
  );
}
