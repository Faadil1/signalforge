"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Radar, ScanSearch, FlaskConical, Bell, Braces, Fingerprint } from "lucide-react";
import { ENABLE_ALERTS, ENABLE_BACKTESTS } from "@/lib/features";

export function MobileNavigation() {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Gate", icon: Radar, code: "05", color: "#6E46FF" },
    { href: "/token", label: "Dossier", icon: ScanSearch, code: "02", color: "#00C9E8" },
    ...(ENABLE_BACKTESTS ? [{ href: "/strategies", label: "Lab", icon: FlaskConical, code: "06", color: "#C6F432" }] : []),
    { href: "/playground", label: "Agent", icon: Braces, code: "09", color: "#E73DFF" },
    ...(ENABLE_ALERTS ? [{ href: "/alerts", label: "Alerts", icon: Bell, code: "10", color: "#FF8A1F" }] : []),
    { href: "/judge", label: "Proof", icon: Fingerprint, code: "11", color: "#171522" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-[#f8faff]/94 backdrop-blur-xl md:hidden">
      <div className="prism-rule h-[3px]" />
      <div className="flex h-[68px] items-stretch overflow-x-auto">
        {items.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 px-2 text-[9px] font-medium uppercase tracking-[0.08em]",
                active ? "bg-white text-text" : "text-text-secondary"
              )}
            >
              {active && <span className="absolute inset-x-3 top-0 h-1 rounded-b-full" style={{ background: item.color }} />}
              <span className="font-mono text-[7px] font-semibold" style={{ color: item.color }}>{item.code}</span>
              <item.icon className="h-4 w-4" style={{ color: active ? item.color : undefined }} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
