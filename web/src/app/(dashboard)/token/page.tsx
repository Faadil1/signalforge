"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area,
} from "recharts";
import { Search, TrendingUp, BarChart3, Info, Activity } from "lucide-react";
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

type SubSignal = { name: string; value: number; confidence: number; available: boolean; reason: string };

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
  hold: "Signals are balanced — no strong directional edge right now. Focus on the confidence level: lower confidence means several components are near-neutral.",
  strong_buy: "Multiple components are aligned bullish with elevated conviction. Strong set-up but always pair with your own risk management.",
  buy: "A cautiously bullish composite. Confirm with trend + volume before sizing up.",
  sell: "The composite is skewing bearish — mostly driven by weak technical/trend structure.",
  strong_sell: "A decisively bearish composite. High conviction short/risk-off posture.",
};

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
      setHistory((hist.history || []).map((h) => ({ ...h, close: h.close })));
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

  useInterval(() => {
    load(token, { silent: true });
  }, POLL_MS);

  useInterval(async () => {
    const t = await fetchTicker(token);
    setTicker(t);
  }, TICKER_POLL_MS);

  const sub = signal?.sub_signals || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${token} Signal Intelligence`}
        subtitle="Live multi-signal analysis with full explainability"
        badge={loading ? <StatusBadge status="stale" label="Loading" /> : error ? <StatusBadge status="error" /> : <StatusBadge status="live" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                type="text"
                value={token}
                maxLength={12}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && load(token)}
                className="input pl-8 w-28 font-mono"
                placeholder="Token"
              />
            </div>
            <Button onClick={() => load(token)} loading={loading}>Analyze</Button>
          </div>
        }
      />

      {error && (
        <Card className="p-4 text-sm text-negative font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => load(token)} className="underline text-brand">retry</button>
        </Card>
      )}

      {!signal && !error && loading && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-6 flex items-center justify-center"><div className="skeleton h-40 w-40 rounded-full" /></div>
          <div className="space-y-4 lg:col-span-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /></div>
        </div>
      )}

      {signal && (
        <>
          {/* Top Row — Gauge + Breakdown */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardBody className="flex flex-col items-center justify-center py-8">
                <ScoreGauge score={signal.score} />
                <div className="mt-4"><RecommendationBadge recommendation={signal.recommendation} /></div>
                {signal.price != null && (
                  <PriceTicker
                    price={ticker?.price ?? signal.price}
                    changePct={ticker?.price_change_pct}
                    className="mt-3 text-sm text-text-secondary"
                  />
                )}
                <p className="mt-2 font-mono text-xs text-text-subtle">confidence {(signal.confidence * 100).toFixed(0)}%</p>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand" /> Signal Breakdown</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {sub.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-medium text-text-secondary">{SIGNAL_LABEL[s.name] || s.name.replace("_", " ")}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, backgroundColor: SIGNAL_COLOR[s.name] || "#22C55E" }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-mono tabular-nums text-text-secondary">{s.value}</span>
                    <Badge tone={s.available ? "positive" : "warning"}>{s.available ? "live" : "n/a"}</Badge>
                  </div>
                ))}
                {signal.coverage != null && (
                  <p className="pt-1 text-[11px] text-text-subtle font-mono">
                    {signal.available_signals}/{signal.total_signals} live · coverage {(signal.coverage * 100).toFixed(0)}%
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Price + Volume Chart */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-positive" /> Price · 30d daily</CardTitle></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toLocaleString()} width={64} />
                    <Tooltip contentStyle={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 10, fontSize: 12, color: "var(--sf-text)" }} />
                    <Area type="monotone" dataKey="close" stroke="#22C55E" strokeWidth={2} fill="url(#priceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-info" /> Volume · 30d daily</CardTitle></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={history}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip contentStyle={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 10, fontSize: 12, color: "var(--sf-text)" }} />
                    <Bar dataKey="volume" fill="#1570EF" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          {/* Bottom Row — Drivers + Interpretation */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Signal Drivers</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {sub.map((s) => (
                  <div key={s.name} className="rounded-lg bg-surface-secondary p-3 ring-1 ring-inset ring-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold font-mono text-text">{SIGNAL_LABEL[s.name] || s.name}</span>
                      <Badge tone={s.available ? "positive" : "warning"}>{s.available ? "live" : "unavailable"}</Badge>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{s.reason}</p>
                    <div className="mt-1.5 font-mono text-[11px] text-text-subtle">
                      value {s.value} · conf {(s.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Info className="h-4 w-4 text-brand" /> Interpretation</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div className="rounded-lg bg-surface-secondary p-4 ring-1 ring-inset ring-border">
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {INTERPRETATION[signal.recommendation] || "Signals are balanced — monitor for a clear directional edge."}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-secondary p-4 ring-1 ring-inset ring-border">
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    <span className="font-semibold text-text">Data sources:</span> klines · open interest · funding rate · 24h ticker — all fetched live from Binance public market data.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
