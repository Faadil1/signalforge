"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Radar, ScanSearch, FlaskConical, Bell, Braces } from "lucide-react";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

export function MobileNavigation() {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Field", icon: Radar },
    { href: "/token", label: "Inspect", icon: ScanSearch },
    ...(ENABLE_BACKTESTS ? [{ href: "/strategies", label: "Lab", icon: FlaskConical }] : []),
    { href: "/playground", label: "Agent", icon: Braces },
    ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", icon: Bell }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
      <div className="flex h-16 items-stretch justify-around">
        {items.slice(0, 5).map((item, index) => {
          const active = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em]",
                active ? "text-brand" : "text-text-secondary"
              )}
            >
              {active && <span className="absolute inset-x-3 top-0 h-px bg-brand" />}
              <span className="font-mono text-[8px] text-text-subtle">0{index + 1}</span>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
