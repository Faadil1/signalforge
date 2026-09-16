"use client";

import { ShieldX, ShieldCheck, Eye, LockKeyhole } from "lucide-react";
import type { DecisionPacket } from "@/lib/api";

function pct(value?: number) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function barWidth(value?: number) {
  return `${Math.max(0, Math.min(100, Math.round((value || 0) * 100)))}%`;
}

export function DecisionGate({ packet }: { packet: DecisionPacket | null }) {
  const refused = packet?.actionability === "insufficient_evidence" || !packet;
  const observing = packet?.actionability === "observe";
  const GateIcon = refused ? ShieldX : observing ? Eye : ShieldCheck;
  const tone = refused ? "#FF4F73" : observing ? "#FF8A1F" : "#00C9E8";
  const status = refused ? "REFUSED" : observing ? "OBSERVE" : "RESEARCH HANDOFF";

  return (
    <section className={`gate-frame ${refused ? "gate-closed" : "gate-open"}`}>
      <div className="gate-door gate-door-left" />
      <div className="gate-door gate-door-right" />

      <div className="relative z-[2] grid min-h-[360px] gap-7 p-6 md:grid-cols-[1fr_1.05fr] md:items-center md:p-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white shadow-card" style={{ background: tone }}>
              <GateIcon className="h-5 w-5 text-prism-ink" />
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle">05 / POLICY GATE</p>
              <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone }}>{status}</p>
            </div>
          </div>

          <p className="mt-8 max-w-xl text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-text md:text-5xl">
            A conclusion only exists when the evidence earns it.
          </p>
          <p className="mt-4 max-w-lg text-sm leading-6 text-text-secondary">
            Coverage and adjusted confidence are separate gates. Passing one never compensates for silently missing the other.
          </p>
        </div>

        <div className="space-y-5 bg-white/88 p-5 shadow-card backdrop-blur md:p-6">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div><p className="atlas-micro">coverage</p><p className="mt-1 font-mono text-4xl font-semibold tracking-[-0.05em] text-text">{pct(packet?.coverage)}</p></div>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-subtle">minimum 60%</span>
            </div>
            <div className="mt-3 h-4 overflow-hidden border border-border bg-surface-secondary/60">
              <div className="h-full bg-prism-violet transition-[width] duration-300" style={{ width: barWidth(packet?.coverage) }} />
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div><p className="atlas-micro">adjusted confidence</p><p className="mt-1 font-mono text-4xl font-semibold tracking-[-0.05em] text-text">{pct(packet?.confidence)}</p></div>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-subtle">minimum 40%</span>
            </div>
            <div className="mt-3 h-4 overflow-hidden border border-border bg-surface-secondary/60">
              <div className="h-full bg-prism-coral transition-[width] duration-300" style={{ width: barWidth(packet?.confidence) }} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-prism-coral"><LockKeyhole className="h-4 w-4" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">execution_authorized:false</span></div>
            <span className="font-mono text-[9px] text-text-subtle">contract {packet?.contract_version || "1.1"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
