"use client";

import { Clock3, TimerReset } from "lucide-react";
import type { DecisionPacket } from "@/lib/api";

export function EvidenceLease({ packet }: { packet: DecisionPacket | null }) {
  const lease = packet?.evidence_lease;
  const limiting = lease?.limiting_raw_source;
  const maxAge = limiting ? packet?.data_quality?.freshness?.[limiting]?.max_age_seconds || 300 : 300;
  const remaining = lease?.remaining_seconds ?? 0;
  const progress = Math.max(0, Math.min(1, maxAge ? remaining / maxAge : 0));
  const style = { "--lease-progress": progress } as React.CSSProperties;

  return (
    <section className="spectral-band grid gap-5 p-5 md:grid-cols-[180px_1fr] md:items-center md:p-6">
      <div className="lease-dial mx-auto" style={style}>
        <div className="text-center">
          <Clock3 className="mx-auto h-5 w-5 text-prism-ink" />
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em] text-prism-ink">{Math.max(0, Math.round(remaining))}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-text-subtle">seconds</p>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip border-prism-lime/60 bg-prism-lime/25 font-mono text-[9px] uppercase tracking-[0.14em] text-prism-ink">04 / EVIDENCE LEASE</span>
          <span className="chip border-border bg-white/65 font-mono text-[9px] uppercase tracking-[0.14em] text-text-secondary">limiter / {limiting || "pending"}</span>
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-text md:text-3xl">Freshness has an expiry. Confidence does not get to outlive its inputs.</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">The lease is bounded by the earliest contributing raw-source deadline. It is deliberately narrow: freshness only.</p>
        <div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">
          <TimerReset className="h-4 w-4 text-prism-lime" />
          FRESHNESS LEASE ≠ FORECAST VALIDITY
        </div>
      </div>
    </section>
  );
}
