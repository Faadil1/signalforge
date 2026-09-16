"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  Database,
  Fingerprint,
  GitBranch,
  Search,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import {
  fetchDecisionPacket,
  fetchRecoveryPlan,
  fetchTicker,
  safeJson,
  type DecisionPacket,
  type RecoveryPlan,
  type Ticker,
} from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { Button } from "@/components/ui/Button";
import { EvidenceLease } from "@/components/forge/EvidenceLease";
import { ReceiptStrip } from "@/components/forge/ReceiptStrip";

const POLL_MS = 12_000;
type HistoryPoint = { date: string; close: number; high: number; low: number; volume: number };

const SIGNALS = ["technical", "trend", "volume", "open_interest", "funding"];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TokenPage() {
  const [token, setToken] = useState("BTC");
  const [input, setInput] = useState("BTC");
  const [packet, setPacket] = useState<DecisionPacket | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPlan | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextToken: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [nextPacket, nextRecovery, nextTicker, historyRes] = await Promise.all([
        fetchDecisionPacket(nextToken),
        fetchRecoveryPlan(nextToken),
        fetchTicker(nextToken),
        fetch(`/api/v1/signal/${nextToken}/history?days=30`),
      ]);
      const nextHistory = await safeJson<{ history: HistoryPoint[] }>(historyRes, { history: [] });
      setPacket(nextPacket);
      setRecovery(nextRecovery);
      setTicker(nextTicker);
      setHistory(nextHistory.history || []);
      setError(nextPacket ? null : "Decision Packet unavailable.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence dossier unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("BTC"); }, [load]);
  useInterval(() => void load(token, true), POLL_MS);

  const inspect = () => {
    const normalized = input.trim().toUpperCase();
    if (!normalized) return;
    setToken(normalized);
    void load(normalized);
  };

  const evidenceByName = useMemo(() => {
    const map = new Map<string, { value?: number; confidence?: number; reason?: string; group: string }>();
    if (!packet) return map;
    Object.entries(packet.evidence).forEach(([group, entries]) => {
      entries.forEach((entry) => map.set(entry.name, { ...entry, group }));
    });
    return map;
  }, [packet]);

  const missing = new Set((recovery?.evidence_debt.unavailable_signals || []).map(String));
  const ledger = packet?.evidence_admission_ledger?.entries || [];

  return (
    <div className="space-y-7">
      <header className="grid gap-6 border-b border-border/70 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="forge-eyebrow">02 / EVIDENCE DOSSIER</p>
          <h1 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">{token}.<br />Open the packet.</h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">A forensic view of what entered the decision, what was excluded, which provider each layer depends on, when the evidence expires and how the packet can be verified.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" /><input className="input w-32 pl-9 font-mono" value={input} maxLength={10} onChange={(event) => setInput(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && inspect()} /></div>
          <Button onClick={inspect} loading={loading}>Inspect dossier</Button>
        </div>
      </header>

      {error && <div className="border border-prism-coral/40 bg-prism-coral/10 px-4 py-3 font-mono text-[10px] text-prism-coral">DOSSIER ERROR / {error}</div>}

      <section className="grid gap-6 xl:grid-cols-[.4fr_.6fr]">
        <div className="forge-panel forge-cut p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="atlas-micro">live market context</p><p className="mt-2 font-mono text-2xl font-semibold text-text">{token}</p><p className="mt-1 font-mono text-[11px] text-text-subtle">${ticker?.price ? ticker.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</p></div>
            <span className={`chip font-mono text-[8px] uppercase tracking-[0.14em] ${packet?.actionability === "insufficient_evidence" ? "border-prism-coral/40 bg-prism-coral/10 text-prism-coral" : "border-prism-cyan/40 bg-prism-cyan/10 text-prism-ink"}`}>{packet?.actionability || "loading"}</span>
          </div>

          <div className="mt-9 grid grid-cols-[1fr_auto] items-end gap-4">
            <div><p className="atlas-micro">composite</p><p className="forge-display mt-2 font-mono text-[88px] font-semibold text-text">{packet ? packet.score.toFixed(1) : "—"}</p></div>
            <div className="pb-2 text-right"><p className="atlas-micro">regime</p><p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-prism-violet">{packet?.regime || "pending"}</p></div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
            <div className="bg-white/80 p-4"><p className="atlas-micro">coverage</p><p className="mt-1 font-mono text-3xl font-semibold">{packet ? `${Math.round(packet.coverage * 100)}%` : "—"}</p></div>
            <div className="bg-white/80 p-4"><p className="atlas-micro">confidence</p><p className="mt-1 font-mono text-3xl font-semibold text-prism-coral">{packet ? `${Math.round(packet.confidence * 100)}%` : "—"}</p></div>
          </div>

          <div className="mt-6 border-t border-border/70 pt-4">
            <div className="flex items-center gap-2 text-prism-coral"><ShieldOff className="h-4 w-4" /><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">execution_authorized:false</span></div>
          </div>
        </div>

        <div className="forge-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-white/60 px-5 py-4 md:px-6"><div><p className="forge-eyebrow">DERIVED EVIDENCE</p><p className="mt-2 text-sm text-text-secondary">Five channels, but only observed/usable channels are allowed into the current conclusion.</p></div><Sparkles className="h-5 w-5 text-prism-violet" /></div>
          <div className="divide-y divide-border/70">
            {SIGNALS.map((name, index) => {
              const evidence = evidenceByName.get(name);
              const unavailable = missing.has(name);
              const color = unavailable ? "#FF4F73" : index === 0 ? "#3257FF" : index === 1 ? "#00C9E8" : index === 2 ? "#C6F432" : "#6E46FF";
              return (
                <div key={name} className={`grid gap-3 px-5 py-4 md:grid-cols-[42px_1fr_100px_120px] md:items-center md:px-6 ${unavailable ? "hatch-excluded" : "bg-white/35"}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-4 border-white font-mono text-[8px] font-semibold shadow-card" style={{ background: color }}>0{index + 1}</span>
                  <div><p className="font-semibold text-text">{label(name)}</p><p className="mt-1 text-xs leading-5 text-text-subtle">{unavailable ? "Unavailable evidence — excluded before fusion." : evidence?.reason || "Observed evidence."}</p></div>
                  <div><p className="atlas-micro">value</p><p className="mt-1 font-mono text-sm font-semibold text-text">{evidence?.value != null ? evidence.value.toFixed(1) : "—"}</p></div>
                  <span className={`chip justify-center font-mono text-[8px] uppercase tracking-[0.13em] ${unavailable ? "border-prism-coral/40 bg-prism-coral/10 text-prism-coral" : "border-prism-cyan/40 bg-prism-cyan/10 text-prism-ink"}`}>{unavailable ? "EXCLUDED" : evidence?.group || "OBSERVED"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.62fr_.38fr]">
        <div className="forge-panel overflow-hidden">
          <div className="flex items-end justify-between gap-4 border-b border-border/70 px-5 py-4 md:px-6"><div><p className="forge-eyebrow">RAW SOURCE ADMISSION</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">The ledger before fusion.</h2></div><Database className="h-6 w-6 text-prism-cobalt" /></div>
          <div className="divide-y divide-border/70">
            {ledger.map((entry) => (
              <div key={entry.raw_source} className={`grid gap-3 px-5 py-4 md:grid-cols-[1fr_110px_130px] md:items-center md:px-6 ${entry.decision_admitted ? "bg-prism-cyan/[0.045]" : "hatch-excluded bg-prism-coral/[0.03]"}`}>
                <div className="flex items-start gap-3"><span className={`mt-1 h-3 w-3 rounded-full ${entry.decision_admitted ? "bg-prism-cyan" : "bg-prism-coral"}`} /><div><p className="font-semibold text-text">{label(entry.raw_source)}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle">{entry.provider}</p></div></div>
                <div><p className="atlas-micro">freshness</p><p className="mt-1 font-mono text-[10px] text-text">{entry.freshness_status}</p></div>
                <span className={`chip justify-center font-mono text-[8px] ${entry.decision_admitted ? "border-prism-cyan/40 bg-prism-cyan/10 text-prism-ink" : "border-prism-coral/40 bg-prism-coral/10 text-prism-coral"}`}>{entry.reason_code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="forge-panel p-5 md:p-6">
          <div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-prism-cobalt" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-cobalt">PROVIDER LINEAGE</span></div>
          <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-text">{packet?.evidence_lineage?.concentration_level || "pending"} concentration.</p>
          <p className="mt-4 text-sm leading-6 text-text-secondary">The interface does not pretend five derived channels equal five independent providers.</p>
          <div className="mt-6 border-t border-border/70 pt-4"><p className="atlas-micro">dominant provider</p><p className="mt-2 font-mono text-[11px] font-semibold text-prism-violet">{packet?.evidence_lineage?.dominant_provider || "pending"}</p></div>
          <div className="mt-5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.13em] text-text-subtle"><ArrowDownRight className="h-4 w-4 text-prism-coral" /> independence_claimed:false</div>
        </div>
      </section>

      <EvidenceLease packet={packet} />

      <section className="forge-panel p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="forge-eyebrow">PRICE TRACE / SECONDARY CONTEXT</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">The chart is evidence context, not the product.</h2></div><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">30D / DAILY</span></div>
        <div className="mt-6 h-[290px]">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="forgePrice" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3257FF" stopOpacity={0.28} /><stop offset="65%" stopColor="#00C9E8" stopOpacity={0.08} /><stop offset="100%" stopColor="#EEF3FF" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#77758E" }} tickLine={false} axisLine={{ stroke: "#B9C6F2" }} minTickGap={30} /><YAxis tick={{ fontSize: 9, fill: "#77758E" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={64} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #B9C6F2", borderRadius: 8, fontSize: 11, color: "#171522" }} /><Area type="monotone" dataKey="close" stroke="#3257FF" strokeWidth={2.4} fill="url(#forgePrice)" /></AreaChart></ResponsiveContainer>
        </div>
      </section>

      <ReceiptStrip packet={packet} recovery={recovery} />

      <section className="grid gap-3 border-t border-border/70 pt-5 md:grid-cols-3">
        {(packet?.invalidation || []).map((item, index) => <div key={item} className="border-l-4 border-prism-coral bg-white/60 p-4"><p className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-subtle">INVALIDATION 0{index + 1}</p><p className="mt-2 text-xs leading-5 text-text-secondary">{item}</p></div>)}
        <div className="border-l-4 border-prism-ink bg-white/60 p-4"><div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-prism-ink" /><p className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-subtle">BOUNDARY</p></div><p className="mt-2 text-xs leading-5 text-text-secondary">Receipt integrity is not a digital signature or proof of external market truth.</p></div>
      </section>
    </div>
  );
}
