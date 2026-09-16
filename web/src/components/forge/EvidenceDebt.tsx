"use client";

import { ArrowRight, Blocks, RotateCcw, X } from "lucide-react";
import type { RecoveryPlan } from "@/lib/api";

export function EvidenceDebt({ recovery }: { recovery: RecoveryPlan | null }) {
  const unavailable = recovery?.evidence_debt.unavailable_signals || [];
  const candidates = recovery?.recovery_candidates || [];
  const confidenceGap = recovery?.evidence_debt.confidence_gap ?? 0;

  return (
    <section className="grid gap-0 overflow-hidden border border-border bg-white/75 lg:grid-cols-[.8fr_1.2fr]">
      <div className="bg-prism-orange/10 p-5 md:p-6 lg:border-r lg:border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Blocks className="h-5 w-5 text-prism-orange" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-orange">08 / EVIDENCE DEBT</span></div>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">gap {Math.round(confidenceGap * 100)} pts</span>
        </div>
        <h3 className="mt-5 text-3xl font-semibold leading-[1] tracking-[-0.045em] text-text">Missing evidence becomes a visible liability.</h3>
        <div className="mt-6 space-y-2">
          {unavailable.length ? unavailable.map((signal, index) => (
            <div key={signal} className="debt-block flex items-center justify-between gap-3 px-4 py-4" style={{ marginLeft: `${index * 12}px` }}>
              <div><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-subtle">unavailable signal</p><p className="mt-1 text-lg font-semibold text-text">{signal.replaceAll("_", " ")}</p></div>
              <X className="h-5 w-5 text-prism-coral" />
            </div>
          )) : (
            <div className="border border-dashed border-border p-4 text-sm text-text-secondary">No unavailable-signal debt in the current packet.</div>
          )}
        </div>
      </div>

      <div className="bg-prism-magenta/[0.055] p-5 md:p-6">
        <div className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-prism-magenta" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-magenta">09 / RECOVERY PLAN</span></div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">SignalForge names the smallest safe reacquisition path it can justify. It never fills a missing market input synthetically.</p>

        <div className="mt-6 space-y-3">
          {candidates.length ? candidates.map((candidate) => (
            <div key={candidate.signal} className="group grid gap-3 border border-prism-magenta/25 bg-white/75 p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-prism-magenta/60 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-text">{candidate.signal.replaceAll("_", " ")}</span><span className="chip border-prism-magenta/25 bg-prism-magenta/[0.08] font-mono text-[8px] uppercase tracking-[0.13em] text-prism-magenta">{candidate.safe_action}</span></div>
                <p className="mt-2 font-mono text-[9px] leading-4 text-text-subtle">{(candidate.source_requirements || []).map((item) => `${item.source}: ${item.current_state || "unknown"} → ${item.required_state || "fresh"}`).join(" · ")}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-prism-magenta transition-transform group-hover:translate-x-1" />
            </div>
          )) : <div className="border border-dashed border-border p-4 text-sm text-text-secondary">Recovery planning appears only when a refusal exposes evidence debt.</div>}
        </div>

        {recovery && <div className="mt-5 border-t border-border/70 pt-4"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">NEXT SAFE ACTION</p><p className="mt-2 font-mono text-[11px] font-semibold text-prism-magenta">{recovery.next_safe_action}</p><p className="mt-2 text-xs leading-5 text-text-secondary">{recovery.re_evaluate_after}</p></div>}
      </div>
    </section>
  );
}
