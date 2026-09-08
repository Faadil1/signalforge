"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutGrid,
  Search,
  LineChart,
  Bell,
  Code2,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

const NAV = [
  {
    href: "/dashboard",
    label: "Market Overview",
    short: "Overview",
    icon: LayoutGrid,
  },
  {
    href: "/token",
    label: "Signal Intelligence",
    short: "Intelligence",
    icon: Search,
  },
  ...(ENABLE_BACKTESTS
    ? [
        {
          href: "/strategies",
          label: "Strategy Lab",
          short: "Strategies",
          icon: LineChart,
          experimental: true,
        },
      ]
    : []),
  {
    href: "/playground",
    label: "Agent API",
    short: "Agent API",
    icon: Code2,
  },
  ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", short: "Alerts", icon: Bell }] : []),
];

export function AppSidebar({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-secondary text-text ring-1 ring-inset ring-border"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.experimental && (
                <span className="chip bg-warning/10 text-warning text-[10px]">Experimental</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md bg-surface-secondary p-3 ring-1 ring-inset ring-border">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">Signal Engine</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            <span className="text-xs font-mono text-positive">ONLINE</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            Live Binance market data · Keyless
          </p>
        </div>
      </div>
    </aside>
  );
}
