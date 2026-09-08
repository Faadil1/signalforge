"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutGrid, Search, LineChart, Bell, Code2 } from "lucide-react";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

export function MobileNavigation() {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid },
    { href: "/token", label: "Signal", icon: Search },
    ...(ENABLE_BACKTESTS ? [{ href: "/strategies", label: "Strategies", icon: LineChart }] : []),
    { href: "/playground", label: "Agent API", icon: Code2 },
    ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", icon: Bell }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface md:hidden">
      <div className="flex h-16 items-stretch justify-around">
        {items.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-brand" : "text-text-secondary"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
