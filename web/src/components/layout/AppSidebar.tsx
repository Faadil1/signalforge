"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Radar,
  ScanSearch,
  FlaskConical,
  Bell,
  Braces,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

const NAV = [
  { href: "/dashboard", label: "Decision Gate", short: "Gate", icon: Radar, code: "05", color: "#6E46FF" },
  { href: "/token", label: "Evidence Dossier", short: "Dossier", icon: ScanSearch, code: "02", color: "#00C9E8" },
  ...(ENABLE_BACKTESTS
    ? [{ href: "/strategies", label: "Calibration Lab", short: "Lab", icon: FlaskConical, code: "06", color: "#C6F432", experimental: true }]
    : []),
  { href: "/playground", label: "Agent Contract", short: "Agent", icon: Braces, code: "09", color: "#E73DFF" },
  ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", short: "Alerts", icon: Bell, code: "10", color: "#FF8A1F" }] : []),
  { href: "/judge", label: "Proof Chain", short: "Proof", icon: Fingerprint, code: "11", color: "#171522" },
];

export function AppSidebar({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "relative hidden shrink-0 flex-col border-r border-border/70 bg-[#f8faff]/88 backdrop-blur-xl md:flex",
        collapsed ? "w-[78px]" : "w-[286px]"
      )}
    >
      <div className="absolute right-[-1px] top-0 h-full w-[3px] bg-gradient-to-b from-prism-cobalt via-prism-cyan via-40% to-prism-magenta opacity-70" />
      <div className="border-b border-border/70 px-5 py-5">
        <Logo />
        {!collapsed && (
          <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-text-subtle">
            <span>mode</span><span className="font-semibold text-prism-violet">evidence foundry</span>
            <span>policy</span><span className="font-semibold text-prism-coral">fail closed</span>
            <span>authority</span><span className="font-semibold text-prism-coral">none</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-5">
        {!collapsed && <p className="mb-4 px-2 font-mono text-[8px] uppercase tracking-[0.21em] text-text-subtle">Lifecycle surfaces</p>}
        <div className="space-y-2">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/judge" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group relative flex min-h-12 items-center gap-3 overflow-hidden border px-3 py-2 text-sm transition-[background-color,border-color,transform,box-shadow] duration-150",
                  active
                    ? "border-border bg-white text-text shadow-card"
                    : "border-transparent text-text-secondary hover:-translate-y-px hover:border-border/70 hover:bg-white/70 hover:text-text"
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className="absolute inset-y-0 left-0 w-[5px]" style={{ background: item.color, opacity: active ? 1 : .38 }} />
                <span className="ml-1 font-mono text-[8px] font-semibold tracking-[0.12em]" style={{ color: item.color }}>{item.code}</span>
                <item.icon className="h-4 w-4 shrink-0" style={{ color: active ? item.color : undefined }} />
                {!collapsed && <span className="flex-1 truncate font-medium">{item.label}</span>}
                {!collapsed && "experimental" in item && item.experimental && <span className="chip border-prism-lime/50 bg-prism-lime/20 font-mono text-[7px] text-prism-ink">LAB</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {!collapsed && (
        <div className="border-t border-border/70 p-4">
          <div className="overflow-hidden border border-prism-coral/30 bg-white">
            <div className="h-1.5 bg-gradient-to-r from-prism-cobalt via-prism-lime to-prism-coral" />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-text-subtle">PUBLIC RUNTIME</p>
                <span className="h-2 w-2 animate-evidence-pulse rounded-full bg-prism-cyan" />
              </div>
              <div className="mt-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-prism-cyan" /><span className="font-mono text-[10px] font-semibold text-text">LIVE / FAIL-CLOSED</span></div>
              <p className="mt-2 text-[10px] leading-relaxed text-text-subtle">Missing evidence remains visible. Recovery never grants execution authority.</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
