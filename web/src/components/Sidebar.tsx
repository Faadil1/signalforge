"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/token", label: "Token Deep Dive", icon: "search" },
  { href: "/strategies", label: "Strategies", icon: "chart" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/playground", label: "API Playground", icon: "code" },
];

const ICONS: Record<string, JSX.Element> = {
  grid: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" />
      <path d="m7 16 4-8 4 4 4-8" />
    </svg>
  ),
  bell: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  code: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen bg-sf-card border-r border-sf-border flex flex-col shrink-0">
      <div className="p-4 border-b border-sf-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sf-accent rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-sf-bg" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">SignalForge</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors",
                active
                  ? "bg-sf-bg text-sf-text font-medium"
                  : "text-sf-muted hover:text-sf-text hover:bg-sf-bg/50"
              )}
            >
              {ICONS[item.icon]}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sf-border">
        <div className="card p-2.5">
          <p className="text-[10px] text-sf-muted uppercase tracking-wider mb-1">Signal Engine</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-sf-accent rounded-full animate-pulse" />
            <span className="text-xs font-mono text-sf-accent">ONLINE</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
