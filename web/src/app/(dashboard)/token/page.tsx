"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area,
} from "recharts";
import { isSignalOk, type SignalOk, type SignalResponse } from "@/lib/api";

type SubSignal = { name: string; value: number; confidence: number; available: boolean; reason: string };

type HistoryPoint = { date: string; close: number; high: number; low: number; volume: number };

const REC_BADGE: Record<string, string> = {
  strong_buy: "bg-sf-accent/15 text-sf-accent",
  buy: "bg-green-500/15 text-green-400",
  hold: "bg-sf-muted/15 text-sf-muted",
  sell: "bg-orange-500/15 text-orange-400",
  strong_sell: "bg-sf-danger/15 text-sf-danger",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 75) return "text-sf-accent";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-sf-muted";
  if (score >= 25) return "text-orange-400";
  return "text-sf-danger";
};

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

export default function TokenPage() {
  const [token, setToken] = useState("BTC");
  const [signal, setSignal] = useState<SignalOk | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    setSignal(null);
    setHistory([]);
    try {
      const [sigRes, histRes] = await Promise.all([
        fetch(`/api/v1/signal/${t}`),
        fetch(`/api/v1/signal/${t}/history?days=30`),
      ]);
      const sig = (await sigRes.json()) as SignalResponse;
      if (!sigRes.ok || !histRes.ok || !isSignalOk(sig)) {
        throw new Error(isSignalOk(sig) ? "Failed to load history" : sig.error.message || "Failed to load token");
      }
      const hist = await histRes.json();
      setSignal(sig);
      setHistory((hist.history as HistoryPoint[]).map((h) => ({ ...h, close: h.close })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("BTC");
  }, [load]);

  const sub = signal?.sub_signals || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && load(token)}
          className="bg-sf-card border border-sf-border rounded px-3 py-1.5 text-sm font-mono w-24 focus:outline-none focus:border-sf-accent"
        />
        <h1 className="text-lg font-semibold">{token} Deep Dive</h1>
        <span className="text-xs text-sf-muted">Live Binance market analysis</span>
        {loading && <span className="text-xs text-sf-muted font-mono animate-pulse">loading…</span>}
      </div>

      {error && (
        <div className="card p-3 text-xs text-sf-danger font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => load(token)} className="underline text-sf-accent">retry</button>
        </div>
      )}

      {!signal && !error && (
        <div className="card p-8 text-center text-xs text-sf-muted">Loading live signal…</div>
      )}

      {signal && (
        <>
          {/* Top Row — Score + Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 flex flex-col items-center justify-center">
              <span className={clsx("text-5xl font-bold font-mono", SCORE_COLOR(signal.score))}>{signal.score}</span>
              <p className="text-[10px] text-sf-muted uppercase tracking-wider mt-1">Composite Score</p>
              <span className={clsx("mt-2 px-2 py-0.5 rounded text-xs font-medium", REC_BADGE[signal.recommendation])}>
                {signal.recommendation.replace("_", " ")}
              </span>
              {signal.price != null && (
                <p className="mt-2 text-sm font-mono text-sf-muted">${signal.price.toLocaleString()}</p>
              )}
              <p className="text-[10px] font-mono text-sf-muted">conf {(signal.confidence * 100).toFixed(0)}%</p>
            </div>

            <div className="card p-4 col-span-2">
              <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Signal Breakdown</h3>
              <div className="space-y-2.5">
                {sub.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-sf-muted">{SIGNAL_LABEL[s.name] || s.name.replace("_", " ")}</span>
                    <div className="flex-1 h-2 bg-sf-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.value}%`, backgroundColor: SIGNAL_COLOR[s.name] || "#22C55E" }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-mono" style={{ color: SIGNAL_COLOR[s.name] || "#22C55E" }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Price + Volume Chart */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Price (30d daily)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 6, fontSize: 11 }} />
                  <Area type="monotone" dataKey="close" stroke="#22C55E" strokeWidth={1.5} fill="url(#priceGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4">
              <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Volume (30d daily)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="volume" fill="#A855F7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row — Live signal drivers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Signal Drivers</h3>
              <div className="space-y-2">
                {sub.map((s) => (
                  <div key={s.name} className="p-2 bg-sf-bg rounded border border-sf-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-medium">{SIGNAL_LABEL[s.name] || s.name}</span>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-mono", s.available ? "bg-sf-accent/15 text-sf-accent" : "bg-orange-500/15 text-orange-400")}>
                        {s.available ? "live" : "unavailable"}
                      </span>
                    </div>
                    <p className="text-xs text-sf-muted">{s.reason}</p>
                    <div className="mt-1 text-[10px] text-sf-muted font-mono">value {s.value} · conf {(s.confidence * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Interpretation</h3>
              <div className="space-y-2">
                <div className="p-2 bg-sf-bg rounded border border-sf-border">
                  <p className="text-xs text-sf-muted leading-relaxed">
                    {signal.recommendation === "hold"
                      ? "Signals are balanced — no strong directional edge right now. Focus on the confidence level: lower confidence means several components are near-neutral."
                      : signal.recommendation === "strong_buy"
                        ? "Multiple components are aligned bullish with elevated conviction. Strong set-up but always pair with your own risk management."
                        : signal.recommendation === "buy"
                          ? "A cautiously bullish composite. Confirm with trend + volume before sizing up."
                          : signal.recommendation === "sell"
                            ? "The composite is skewing bearish — mostly driven by weak technical/trend structure."
                            : "A decisively bearish composite. High conviction short/risk-off posture."}
                  </p>
                </div>
                <div className="p-2 bg-sf-bg rounded border border-sf-border">
                  <p className="text-xs text-sf-muted leading-relaxed">
                    <span className="text-sf-accent">Data sources:</span> klines · open interest · funding rate · 24h ticker — all fetched live from Binance public market data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}