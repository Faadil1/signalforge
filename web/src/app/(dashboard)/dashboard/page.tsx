"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Database,
  GitBranch,
  RefreshCw,
  Search,
  ShieldOff,
  TriangleAlert,
} from "lucide-react";
import {
  fetchDecisionPacket,
  fetchRecoveryPlan,
  fetchStressResult,
  fetchTicker,
  type DecisionPacket,
  type RecoveryPlan,
  type StressResult,
  type Ticker,
} from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { Button } from "@/components/ui/Button";
import { DecisionGate } from "@/components/forge/DecisionGate";
import { EvidenceLease } from "@/components/forge/EvidenceLease";
import { EvidenceDebt } from "@/components/forge/EvidenceDebt";
import { ReceiptStrip } from "@/components/forge/ReceiptStrip";

const POLL_MS = 12_000;
const QUICK = ["BTC", "ETH", "SOL", "BNB"];

function pct(value?: number) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export default function DashboardPage() {
  const [token, setToken] = useState("BTC");
  const [input, setInput] = useState("BTC");
  const [packet, setPacket] = useState<DecisionPacket | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPlan | null>(null);
  const [stress, setStress] = useState<StressResult | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextToken: string, quiet = false) => {
    if (!quiet) setLoading(true);
    const [nextPacket, nextRecovery, nextStress, nextTicker] = await Promise.all([
      fetchDecisionPacket(nextToken),
      fetchRecoveryPlan(nextToken),
      fetchStressResult(nextToken),
      fetchTicker(nextToken),
    ]);
    setPacket(nextPacket);
    setRecovery(nextRecovery);
    setStress(nextStress);
    setTicker(nextTicker);
    setError(nextPacket ? null : `Could not load a Decision Packet for ${nextToken}.`);
    setLoading(false);
  }, []);

  useEffect(() => { void load("BTC"); }, [load]);
  useInterval(() => void load(token, true), POLL_MS);

  const inspect = (nextToken: string) => {
    const normalized = nextToken.trim().toUpperCase();
    if (!normalized) return;
    setToken(normalized);
    setInput(normalized);
    void load(normalized);
  };

  const ledger = packet?.evidence_admission_ledger?.entries || [];
  const admitted = ledger.filter((entry) => entry.decision_admitted);
  const excluded = ledger.filter((entry) => !entry.decision_admitted);
  const unavailable = packet?.data_quality.quality_summary?.unavailable_sources || [];
  const liveProviders = packet?.evidence_lineage?.unique_live_providers || [];
  const refusing = packet?.actionability === "insufficient_evidence";

  const marketPrice = useMemo(() => ticker?.price ? `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(ticker.price)}` : "—", [ticker]);

  return (
    <div className="space-y-7">
      <header className="grid gap-6 border-b border-border/70 pb-6 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <p className="forge-eyebrow">05 / DECISION GATE</p>
          <h1 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">One market.<br />Every reason to trust — or refuse it.</h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">This surface is organized by evidence state, not by price performance. The gate cannot hide missing inputs behind a score.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK.map((item) => (
            <button key={item} onClick={() => inspect(item)} className={`chip font-mono text-[9px] uppercase tracking-[0.14em] transition ${token === item ? "border-prism-violet bg-prism-violet text-white" : "border-border bg-white/70 text-text-secondary hover:border-prism-violet/50"}`}>{item}</button>
          ))}
          <div className="relative ml-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input className="input w-32 pl-9 font-mono" value={input} maxLength={10} onChange={(event) => setInput(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && inspect(input)} aria-label="Market token" />
          </div>
          <Button variant="secondary" onClick={() => void load(token)} loading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
      </header>

      {error && <div className="border border-prism-coral/40 bg-prism-coral/10 px-4 py-3 font-mono text-[10px] text-prism-coral">GATE ERROR / {error}</div>}

      <section className="grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-6">
        {[
          ["market", token, "#3257FF"],
          ["price context", marketPrice, "#00C9E8"],
          ["score", packet ? packet.score.toFixed(1) : "—", "#6E46FF"],
          ["coverage", pct(packet?.coverage), "#6E46FF"],
          ["confidence", pct(packet?.confidence), refusing ? "#FF4F73" : "#00C9E8"],
          ["authority", "NONE", "#FF4F73"],
        ].map(([label, value, color]) => (
          <div key={label} className="relative bg-white/82 p-4">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
            <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-text-subtle">{label}</p>
            <p className="mt-2 truncate font-mono text-lg font-semibold text-text">{value}</p>
          </div>
        ))}
      </section>

      <DecisionGate packet={packet} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="forge-panel overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 bg-white/60 px-5 py-4 md:px-6">
            <div><p className="forge-eyebrow">02 / ADMISSION LEDGER</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">What actually entered the decision?</h2></div>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">{admitted.length} admitted / {excluded.length} excluded</span>
          </div>
          <div className="divide-y divide-border/70">
            {ledger.map((entry, index) => (
              <motion.div key={entry.raw_source} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .03 }} className={`grid gap-3 px-5 py-4 md:grid-cols-[42px_1fr_110px_140px] md:items-center md:px-6 ${entry.decision_admitted ? "bg-prism-cyan/[0.045]" : "hatch-excluded bg-prism-coral/[0.035]"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-4 border-white shadow-card ${entry.decision_admitted ? "bg-prism-cyan" : "bg-prism-coral"}`}>{entry.decision_admitted ? <Check className="h-4 w-4 text-prism-ink" /> : <TriangleAlert className="h-4 w-4 text-prism-ink" />}</div>
                <div><p className="font-semibold text-text">{entry.raw_source.replaceAll("_", " ")}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle">{entry.provider} · {entry.freshness_status}</p></div>
                <div><p className="atlas-micro">used by</p><p className="mt-1 font-mono text-[9px] leading-4 text-text-secondary">{(entry.admitted_signals || []).join(", ") || "none"}</p></div>
                <span className={`chip justify-center font-mono text-[8px] uppercase tracking-[0.12em] ${entry.decision_admitted ? "border-prism-cyan/40 bg-prism-cyan/12 text-prism-ink" : "border-prism-coral/40 bg-prism-coral/10 text-prism-coral"}`}>{entry.reason_code}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="forge-panel p-5 md:p-6">
            <div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-prism-cobalt" /><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-cobalt">03 / LINEAGE</p></div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-text">Provider concentration stays visible.</h2>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
              <div className="bg-white/82 p-4"><p className="atlas-micro">dominant provider</p><p className="mt-2 font-mono text-[12px] font-semibold text-text">{packet?.evidence_lineage?.dominant_provider || "pending"}</p></div>
              <div className="bg-white/82 p-4"><p className="atlas-micro">concentration</p><p className="mt-2 font-mono text-[12px] font-semibold text-prism-coral">{packet?.evidence_lineage?.concentration_level || "pending"}</p></div>
            </div>
            <div className="mt-5 space-y-2">{liveProviders.map((provider) => <div key={provider} className="flex items-center gap-3 border-b border-border/70 py-2"><Database className="h-4 w-4 text-prism-cyan" /><span className="font-mono text-[10px] text-text-secondary">{provider}</span></div>)}</div>
            <p className="mt-4 font-mono text-[8px] uppercase leading-4 tracking-[0.13em] text-text-subtle">Lineage diagnostic ≠ statistical independence.</p>
          </div>

          <EvidenceLease packet={packet} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[.65fr_.35fr]">
        <EvidenceDebt recovery={recovery} />
        <div className="forge-panel p-5 md:p-6">
          <p className="forge-eyebrow">06 / FRAGILITY</p>
          <p className="forge-display mt-5 text-5xl font-semibold text-text">{stress?.fragility_class?.replaceAll("_", " ") || "pending"}</p>
          <p className="mt-5 text-sm leading-6 text-text-secondary">SignalForge stress-tests the current observed evidence by removing channels/providers. It does not invent replacement values or replay history.</p>
          <div className="mt-6 border-t border-border/70 pt-4">
            <p className="atlas-micro">current unavailable raw sources</p>
            <p className="mt-2 font-mono text-[11px] font-semibold text-prism-coral">{unavailable.join(" + ") || "none"}</p>
          </div>
          <div className="mt-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-prism-coral"><ShieldOff className="h-4 w-4" /> execution_authorized:false</div>
        </div>
      </section>

      <ReceiptStrip packet={packet} recovery={recovery} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-subtle">The next stage after refusal is evidence acquisition — not execution.</p>
        <a href="/token" className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-prism-violet hover:underline">Open full dossier <ArrowRight className="h-4 w-4" /></a>
      </div>
    </div>
  );
}
