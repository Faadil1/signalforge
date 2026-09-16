"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="forge-shell flex min-h-screen overflow-hidden bg-surface-app">
      <AppSidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="pointer-events-none sticky top-0 z-20 hidden h-8 items-center justify-between border-b border-border/70 bg-[#eef3ff]/84 px-6 font-mono text-[8px] uppercase tracking-[0.18em] text-text-subtle backdrop-blur-xl md:flex">
          <span className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-prism-cyan" /> SIGNALFORGE / EVIDENCE FOUNDRY</span>
          <span className="text-prism-coral">AVAILABLE ≠ FRESH ≠ CONSISTENT ≠ ACTIONABLE</span>
        </div>
        <div className="prism-rule sticky top-8 z-20 hidden h-[3px] md:block" />
        <div className="mx-auto max-w-[1640px] p-4 md:p-6 lg:p-8">
          <div className="space-y-6">{children}</div>
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
}
