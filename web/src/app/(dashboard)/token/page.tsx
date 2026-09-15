"use client";

import { useCallback, useEffect, useState } from "react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area,
} from "recharts";
import { Search, TrendingUp, BarChart3, Info, Activity, ShieldCheck } from "lucide-react";
import { fetchTicker, isSignalOk, safeJson, type SignalResponse, type SignalOk, type Ticker } from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { PageHeader } from "@/components/layout/PageHeader";
import { PriceTicker } from "@/components/market/PriceTicker";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScoreGauge } from "@/components/charts/ScoreGauge";
import { RecommendationBadge } from "@/components/signal/RecommendationBadge";
import { Button } from "@/components/ui/Button";

type HistoryPoint = { date: string; close: number; high: number; low: number; volume: number };

const SIGNAL_LABEL: Record<string, string> = {
  technical: "Technical",
  trend: "Trend",
  open_interest: "Open Interest",
  funding: "Funding",
  volume: "Volume",
};

const SIGNAL_COLOR: Record<string, string> = {
  technical: "#3B82F6",
  trend: "#22C55E",
  open_interest: "#F59E0B",
  funding: "#06B6D4",
  volume: "#A855F7",
};

const POLL_MS = 10_000;
const TICKER_POLL_MS = 4_000;

const INTERPRETATION: Record<string, string> = {
  insufficient_evidence: "Evidence coverage or confidence is below the actionability threshold. The correct system behavior is to abstain rather than manufacture directional confidence.",
  hold: "Available evidence is balanced. Treat the packet as an observation, not an execution instruction.",
  strong_buy: "Available price-derived evidence is strongly bullish. Verify coverage, provenance and missing channels before using the result downstream.",
  buy: "Available evidence leans bullish, but the packet remains research output with no execution authority.",
  sell: "Available evidence leans bearish. Inspect the contributing channels and coverage before drawing a downstream conclusion.",
  strong_sell: "Available evidence is strongly bearish. The packet remains advisory research output, never an execution authorization.",
};

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "Multi-provider public data";
  if (provider === "binance_public") return "Binance public data";
  if (provider === "coinbase_exchange") return "Coinbase Exchange";
  return provider || "Explicit provenance";
}

export default function TokenPage() {
  const [token, setToken] = useState("BTC");
  const [signal, setSignal] = useState<SignalOk | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
      setSignal(null);
      setHistory([]);
      setTicker(null);
    }
    try {
      const [sigRes, histRes, tickerRes] = await Promise.all([
        fetch(`/api/v1/signal/${t}`),
        fetch(`/api/v1/signal/${t}/history?days=30`),
        fetchTicker(t),
      ]);
      const sig = await safeJson<SignalResponse>(sigRes, {
        ok: false,
        token: t,
        error: { code: "UNPARSEABLE", message: "Unexpected response" },
      });
      if (!sigRes.ok || !histRes.ok || !isSignalOk(sig)) {
        throw new Error(isSignalOk(sig) ? "Failed to load history" : sig.error.message || "Failed to load token");
      }
      const hist = await safeJson<{ history: HistoryPoint[] }>(histRes, { history: [] });
      setSignal(sig);
      setHistory(hist.history || []);
      setTicker(tickerRes);
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : "Failed to load token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("BTC");
  }, [load]);

  useInterval(() => load(token, { silent: true }), POLL_MS);
  useInterval(async () => setTicker(await fetchTicker(token)), TICKER_POLL_MS);

  const sub = signal?.sub_signals || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${token} Signal Intelligence`}
        subtitle="Evidence-gated analysis with explicit provenance and exclusion states"
        badge={loading ? <StatusBadge status="stale" label="Loading" /> : error ? <StatusBadge status="error" /> : <StatusBadge status="live" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input type="text" value={token} maxLength={12} onChange={(e) => setToken(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && load(token)} className="input pl-8 w-28 font-mono" placeholder="Token" />
            </div>
            <Button onClick={() => load(token)} loading={loading}>Analyze</Button>
          </div>
        }
      />

      {error && <Card className="p-4 text-sm text-negative font-mono flex items-center justify-between"><span>{error}</span><button onClick={() => load(token)} className="underline text-brand">retry</button></Card>}

      {!signal && !error && loading && (
        <div className="grid gap-6 lg:grid-cols-3"><div className="card p-6 flex items-center justify-center"><div className="skeleton h-40 w-40 rounded-full" /></div><div className="space-y-4 lg:col-span-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /></div></div>
      )}

      {signal && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardBody className="flex flex-col items-center justify-center py-8">
                <ScoreGauge score={signal.score} />
                <div className="mt-4"><RecommendationBadge recommendation={signal.recommendation} /></div>
                {signal.price != null && <PriceTicker price={ticker?.price ?? signal.price} changePct={ticker?.price_change_pct} className="mt-3 text-sm text-text-secondary" />}
                <p className="mt-2 font-mono text-xs text-text-subtle">confidence {(signal.confidence * 100).toFixed(0)}% · coverage {(signal.coverage * 100).toFixed(0)}%</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Badge tone="neutral">{providerLabel(signal.source_meta?.provider)}</Badge>
                  <Badge tone="warning">execution unauthorized</Badge>
                </div>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand" /> Evidence Breakdown</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {sub.map((s) => (
                  <div key={s.name} className={s.available ? "flex items-center gap-3" : "flex items-center gap-3 rounded-md border border-dashed border-border bg-surface-secondary/40 p-2"}>
                    <span className="w-28 text-xs font-medium text-text-secondary">{SIGNAL_LABEL[s.name] || s.name.replace("_", " ")}</span>
                    {s.available ? (
                      <>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary"><div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, backgroundColor: SIGNAL_COLOR[s.name] || "#22C55E" }} /></div>
                        <span className="w-8 text-right text-xs font-mono tabular-nums text-text-secondary">{s.value}</span>
                        <Badge tone="positive">used</Badge>
                      </>
                    ) : (
                      <><span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-subtle">not used in fusion</span><Badge tone="neutral">excluded</Badge></>
                    )}
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-text-subtle font-mono">{signal.available_signals}/{signal.total_signals} usable · coverage {(signal.coverage * 100).toFixed(0)}% · {signal.actionability.replace("_", " ")}</p>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-positive" /> Price · 30d daily</CardTitle></CardHeader>
              <CardBody><ResponsiveContainer width="100%" height={220}><AreaChart data={history}><defs><linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} /><stop offset="100%" stopColor="#22C55E" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toLocaleString()} width={64} /><Tooltip contentStyle={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 10, fontSize: 12, color: "var(--sf-text)" }} /><Area type="monotone" dataKey="close" stroke="#22C55E" strokeWidth={2} fill="url(#priceGrad)" /></AreaChart></ResponsiveContainer></CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-info" /> Volume · 30d daily</CardTitle></CardHeader>
              <CardBody><ResponsiveContainer width="100%" height={220}><BarChart data={history}><XAxis dataKey="date" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} width={64} /><Tooltip contentStyle={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 10, fontSize: 12, color: "var(--sf-text)" }} /><Bar dataKey="volume" fill="#1570EF" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Evidence Drivers</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {sub.map((s) => (
                  <div key={s.name} className="rounded-lg bg-surface-secondary p-3 ring-1 ring-inset ring-border">
                    <div className="flex items-center justify-between"><span className="text-[13px] font-semibold font-mono text-text">{SIGNAL_LABEL[s.name] || s.name}</span><Badge tone={s.available ? "positive" : "neutral"}>{s.available ? "used" : "excluded"}</Badge></div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{s.reason}</p>
                    <div className="mt-1.5 font-mono text-[11px] text-text-subtle">{s.available ? `value ${s.value} · conf ${(s.confidence * 100).toFixed(0)}%` : "Unavailable evidence · not used in composite"}</div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Info className="h-4 w-4 text-brand" /> Interpretation & Provenance</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div className="rounded-lg bg-surface-secondary p-4 ring-1 ring-inset ring-border"><p className="text-[13px] leading-relaxed text-text-secondary">{INTERPRETATION[signal.actionability === "insufficient_evidence" ? "insufficient_evidence" : signal.recommendation] || "Inspect the evidence packet before drawing a downstream conclusion."}</p></div>
                <div className="rounded-lg bg-surface-secondary p-4 ring-1 ring-inset ring-border">
                  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-positive" /><span className="text-[13px] font-semibold text-text">Observed source provenance</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">{Object.entries(signal.source_meta?.sources || {}).map(([name, source]) => <Badge key={name} tone={source === "unavailable" ? "neutral" : "brand"}>{name.replace("open_interest", "OI")}: {source}</Badge>)}</div>
                  <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">Provider mode: {providerLabel(signal.source_meta?.provider)}. Unavailable channels stay unavailable; SignalForge does not relabel or synthesize them.</p>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
