"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="atlas-shell flex min-h-screen overflow-hidden bg-surface-app">
      <AppSidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="pointer-events-none sticky top-0 z-10 hidden h-7 items-center justify-between border-b border-border/70 bg-surface-app/80 px-6 font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle backdrop-blur-sm md:flex">
          <span>SignalForge / Observation Field</span>
          <span>AVAILABLE ≠ FRESH ≠ CONSISTENT ≠ ACTIONABLE</span>
        </div>
        <div className="mx-auto max-w-[1540px] p-4 md:p-6 lg:p-8">
          <div className="space-y-6">{children}</div>
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
}
