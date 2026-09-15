"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Radar,
  ScanSearch,
  ActivitySquare,
  Bell,
  Braces,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

const NAV = [
  { href: "/dashboard", label: "Observation Field", short: "Field", icon: Radar, code: "01" },
  { href: "/token", label: "Evidence Inspect", short: "Inspect", icon: ScanSearch, code: "02" },
  ...(ENABLE_BACKTESTS
    ? [{ href: "/strategies", label: "Calibration Lab", short: "Lab", icon: ActivitySquare, code: "03", experimental: true }]
    : []),
  { href: "/playground", label: "Agent Interface", short: "API", icon: Braces, code: "04" },
  ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", short: "Alerts", icon: Bell, code: "05" }] : []),
];

export function AppSidebar({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "relative hidden shrink-0 flex-col border-r border-border bg-surface/88 backdrop-blur-sm md:flex",
        collapsed ? "w-[72px]" : "w-[272px]"
      )}
    >
      <div className="absolute right-[-1px] top-0 h-24 w-px bg-brand/60" />
      <div className="border-b border-border px-5 py-5">
        <Logo />
        {!collapsed && (
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-subtle">
            <span>mode</span><span className="text-text-secondary">evidence instrument</span>
            <span>policy</span><span className="text-text-secondary">fail closed</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-5">
        {!collapsed && <p className="mb-3 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-text-subtle">Instrument index</p>}
        <div className="space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group relative flex min-h-11 items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-l-brand bg-surface-secondary/80 text-text"
                    : "border-l-transparent text-text-secondary hover:border-l-border hover:bg-surface-secondary/45 hover:text-text"
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className={clsx("font-mono text-[9px] tracking-[0.12em]", active ? "text-brand" : "text-text-subtle")}>{item.code}</span>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.experimental && <span className="atlas-stamp border-warning/40 text-warning">LAB</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {!collapsed && (
        <div className="border-t border-border p-4">
          <div className="border border-brand/30 bg-brand/[0.035] p-3">
            <div className="flex items-center justify-between">
              <p className="atlas-kicker">RUNTIME FIELD</p>
              <span className="h-1.5 w-1.5 animate-evidence-pulse rounded-full bg-positive" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-positive" />
              <span className="font-mono text-[11px] font-semibold text-text">LIVE / MULTI-PROVIDER</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-text-subtle">
              Provenance is explicit. Missing evidence remains excluded. Execution authority stays separate.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
