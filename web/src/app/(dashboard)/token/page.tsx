"use client";

import { useCallback, useEffect, useState } from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import { Search, Radar, ScanSearch, ShieldCheck, Layers3 } from "lucide-react";
import { fetchTicker, isSignalOk, safeJson, type SignalResponse, type SignalOk, type Ticker } from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { PriceTicker } from "@/components/market/PriceTicker";
import { RecommendationBadge } from "@/components/signal/RecommendationBadge";
import { Button } from "@/components/ui/Button";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { EvidenceRail } from "@/components/atlas/EvidenceRail";
import { ActionabilityGate } from "@/components/atlas/ActionabilityGate";

const POLL_MS = 10_000;
const TICKER_POLL_MS = 4_000;

type HistoryPoint = { date: string; close: number; high: number; low: number; volume: number };

const SIGNAL_LABEL: Record<string, string> = {
  technical: "Technical structure",
  trend: "Directional trend",
  open_interest: "Open interest",
  funding: "Funding bias",
  volume: "Volume pressure",
};

const SIGNAL_CODE: Record<string, string> = {
  technical: "S-01",
  trend: "S-02",
  volume: "S-03",
  open_interest: "S-04",
  funding: "S-05",
};

const INTERPRETATION: Record<string, string> = {
  insufficient_evidence: "Coverage or confidence is below the actionability threshold. The correct system behavior is abstention, not synthetic certainty.",
  hold: "Available evidence is balanced. Treat the packet as observation, not execution instruction.",
  strong_buy: "Available evidence is strongly bullish. Verify provenance and missing channels before using the packet downstream.",
  buy: "Available evidence leans bullish, but the packet remains research output with no execution authority.",
  sell: "Available evidence leans bearish. Inspect contributing channels and exclusions before drawing a downstream conclusion.",
  strong_sell: "Available evidence is strongly bearish. Execution authority remains separate and false.",
};

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "MULTI-PROVIDER PUBLIC";
  if (provider === "binance_public") return "BINANCE PUBLIC";
  if (provider === "coinbase_exchange") return "COINBASE EXCHANGE";
  return provider?.replaceAll("_", " ").toUpperCase() || "PROVENANCE PENDING";
}

export default function TokenPage() {
  const [token, setToken] = useState("BTC");
  const [signal, setSignal] = useState<SignalOk | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextToken: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setSignal(null);
      setHistory([]);
      setTicker(null);
    }
    try {
      const [signalRes, historyRes, tickerRes] = await Promise.all([
        fetch(`/api/v1/signal/${nextToken}`),
        fetch(`/api/v1/signal/${nextToken}/history?days=30`),
        fetchTicker(nextToken),
      ]);
      const nextSignal = await safeJson<SignalResponse>(signalRes, {
        ok: false,
        token: nextToken,
        error: { code: "UNPARSEABLE", message: "Unexpected response" },
      });
      if (!signalRes.ok || !historyRes.ok || !isSignalOk(nextSignal)) {
        throw new Error(isSignalOk(nextSignal) ? "History unavailable" : nextSignal.error.message || "Evidence packet unavailable");
      }
      const nextHistory = await safeJson<{ history: HistoryPoint[] }>(historyRes, { history: [] });
      setSignal(nextSignal);
      setHistory(nextHistory.history || []);
      setTicker(tickerRes);
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Evidence packet unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("BTC");
  }, [load]);
  useInterval(() => void load(token, true), POLL_MS);
  useInterval(async () => setTicker(await fetchTicker(token)), TICKER_POLL_MS);

  const subSignals = signal?.sub_signals || [];

  return (
    <div className="space-y-5">
      <header className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="field-label">02 / EVIDENCE INSPECT</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-text md:text-5xl">{token} / evidence dossier</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">One market, opened as a layered evidence record: what was observed, what entered fusion, what was excluded, and where actionability stops.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input className="input w-32 pl-9 font-mono" value={token} maxLength={12} onChange={(event) => setToken(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void load(token)} />
          </div>
          <Button onClick={() => void load(token)} loading={loading}><ScanSearch className="h-4 w-4" /> Inspect</Button>
        </div>
      </header>

      {error && <div className="border border-negative/40 bg-negative/5 px-4 py-3 font-mono text-[11px] text-negative">INSPECT ERROR / {error}</div>}

      {!signal && loading ? (
        <div className="grid gap-5 xl:grid-cols-12"><div className="skeleton h-[440px] xl:col-span-5" /><div className="skeleton h-[440px] xl:col-span-7" /></div>
      ) : signal ? (
        <>
          <div className="grid gap-5 xl:grid-cols-12">
            <AtlasPanel label="Decision Plate" code="INSP-A" tone={signal.actionability === "insufficient_evidence" ? "critical" : "live"} meta={providerLabel(signal.source_meta?.provider)} className="xl:col-span-5">
              <div className="flex items-start justify-between gap-4">
                <div><p className="atlas-micro">market</p><p className="mt-2 font-mono text-3xl font-semibold text-text">{signal.token}</p>{signal.price != null && <PriceTicker price={ticker?.price ?? signal.price} changePct={ticker?.price_change_pct} className="mt-1 text-xs text-text-secondary" />}</div>
                <RecommendationBadge recommendation={signal.recommendation} />
              </div>

              <div className="my-8 border-y border-border py-7">
                <div className="grid grid-cols-[1fr_auto] items-end gap-5">
                  <div><p className="atlas-micro">composite score</p><p className="decision-score mt-3 font-mono text-[108px] font-semibold text-text">{signal.score.toFixed(0)}</p></div>
                  <Radar className="mb-2 h-12 w-12 text-brand/55" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-px border border-border bg-border">
                  <div className="bg-surface/80 p-3"><p className="atlas-micro">confidence</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{Math.round(signal.confidence * 100)}%</p></div>
                  <div className="bg-surface/80 p-3"><p className="atlas-micro">coverage</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{Math.round(signal.coverage * 100)}%</p></div>
                </div>
              </div>

              <ActionabilityGate actionability={signal.actionability} coverage={signal.coverage} confidence={signal.confidence} executionAuthorized={signal.execution_authorized} />
            </AtlasPanel>

            <AtlasPanel label="Evidence Strata" code="INSP-B" meta={`${signal.available_signals}/${signal.total_signals} used`} className="xl:col-span-7">
              <div className="border-y border-border">
                {subSignals.map((subSignal, index) => (
                  <div key={subSignal.name} className="grid gap-3 border-b border-border py-4 last:border-b-0 md:grid-cols-[56px_1fr_92px_110px] md:items-center">
                    <span className="font-mono text-[10px] text-text-subtle">{SIGNAL_CODE[subSignal.name] || `S-0${index + 1}`}</span>
                    <div>
                      <div className="flex items-center gap-2"><span className={subSignal.available ? "evidence-dot evidence-dot-live" : "evidence-dot evidence-dot-excluded"} /><p className="text-sm font-semibold text-text">{SIGNAL_LABEL[subSignal.name] || subSignal.name}</p></div>
                      <p className="mt-1 text-xs leading-5 text-text-subtle">{subSignal.reason}</p>
                    </div>
                    <div className="font-mono text-sm text-text">{subSignal.available ? subSignal.value.toFixed(1) : "—"}</div>
                    <span className={subSignal.available ? "atlas-stamp atlas-stamp-live" : "atlas-stamp atlas-stamp-refused"}>{subSignal.available ? "USED" : "EXCLUDED"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5"><EvidenceRail sources={signal.source_meta?.sources} coverage={signal.coverage} compact /></div>
            </AtlasPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            <AtlasPanel label="Price Trace" code="INSP-C" meta="30D / DAILY" className="xl:col-span-7">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="atlasPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F766E" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0F766E" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={{ stroke: "#B9C5BF" }} minTickGap={28} />
                  <YAxis tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(value) => value.toLocaleString()} width={64} />
                  <Tooltip contentStyle={{ background: "#EAF0ED", border: "1px solid #B9C5BF", borderRadius: 2, fontSize: 11, color: "#1B2421" }} />
                  <Area type="monotone" dataKey="close" stroke="#0F766E" strokeWidth={2} fill="url(#atlasPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            </AtlasPanel>

            <AtlasPanel label="Volume Trace" code="INSP-D" meta="30D / DAILY" className="xl:col-span-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={{ stroke: "#B9C5BF" }} minTickGap={28} />
                  <YAxis tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip contentStyle={{ background: "#EAF0ED", border: "1px solid #B9C5BF", borderRadius: 2, fontSize: 11, color: "#1B2421" }} />
                  <Bar dataKey="volume" fill="#A44E2B" radius={[1,1,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </AtlasPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            <AtlasPanel label="Interpretation Boundary" code="INSP-E" tone="quiet" className="xl:col-span-5">
              <div className="flex items-start gap-3"><Layers3 className="mt-0.5 h-5 w-5 text-brand" /><div><p className="text-sm font-semibold text-text">What the packet means</p><p className="mt-2 text-sm leading-6 text-text-secondary">{INTERPRETATION[signal.actionability === "insufficient_evidence" ? "insufficient_evidence" : signal.recommendation] || "Inspect the evidence packet before drawing a downstream conclusion."}</p></div></div>
            </AtlasPanel>

            <AtlasPanel label="Provenance Contract" code="INSP-F" tone="live" className="xl:col-span-7">
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
                <div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-positive" /><p className="text-sm font-semibold text-text">Observed provider chain</p></div><p className="mt-2 text-xs leading-5 text-text-secondary">{providerLabel(signal.source_meta?.provider)}. Unavailable channels remain unavailable; no source is relabelled as healthy to increase coverage.</p></div>
                <span className="atlas-stamp atlas-stamp-refused">EXECUTION UNAUTHORIZED</span>
              </div>
            </AtlasPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
