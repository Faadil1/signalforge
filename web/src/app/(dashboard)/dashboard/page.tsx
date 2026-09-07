"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { isSignalOk, type SignalCard, type SubSignal } from "@/lib/api";

type SignalRow = {
  token: string;
  price?: number;
  score?: number;
  confidence?: number;
  recommendation?: string;
  sub_signals?: SubSignal[];
  error?: string;
};

const SCORE_COLOR = (score: number) => {
  if (score >= 75) return "text-sf-accent";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-sf-muted";
  if (score >= 25) return "text-orange-400";
  return "text-sf-danger";
};

const REC_BADGE: Record<string, string> = {
  strong_buy: "bg-sf-accent/15 text-sf-accent",
  buy: "bg-green-500/15 text-green-400",
  hold: "bg-sf-muted/15 text-sf-muted",
  sell: "bg-orange-500/15 text-orange-400",
  strong_sell: "bg-sf-danger/15 text-sf-danger",
};

const DEFAULT_TOKENS = "BTC,ETH,SOL,BNB,XRP,DOGE,AVAX,ARB";

function cardToRow(card: SignalCard): SignalRow {
  if (isSignalOk(card)) {
    return {
      token: card.token,
      price: card.price,
      score: card.score,
      confidence: card.confidence,
      recommendation: card.recommendation,
      sub_signals: card.sub_signals,
    };
  }
  return { token: card.token, error: card.error.message };
}

function SubSignalBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 text-sf-muted truncate">{name.replace("_", " ")}</span>
      <div className="flex-1 h-1.5 bg-sf-bg rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full", value >= 60 ? "bg-sf-accent" : value >= 40 ? "bg-sf-muted" : "bg-sf-danger")}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-sf-muted">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const [quickToken, setQuickToken] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/signals?tokens=${DEFAULT_TOKENS}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setSignals((data.signals as SignalCard[]).map(cardToRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const loadDetail = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`/api/v1/signal/${token}`);
        const card: SignalCard = await res.json();
        const row = cardToRow(card);
        setSignals((prev) => {
          const idx = prev.findIndex((s) => s.token === row.token);
          if (idx === -1) return [...prev, row];
          const next = [...prev];
          next[idx] = row;
          return next;
        });
        setSelected(row);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to load ${token}, try again.`);
      } finally {
        setQuickLoading(false);
      }
    },
    []
  );

  const handleQuickSignal = () => {
    const token = quickToken.trim().toUpperCase();
    if (!token) return;
    setQuickLoading(true);
    loadDetail(token);
  };

  const liveRows = signals.filter((s) => s.score !== undefined && !s.error);
  const avgConfidence = liveRows.length
    ? (liveRows.reduce((acc, s) => acc + (s.confidence || 0), 0) / liveRows.length) * 100
    : 0;
  const best = liveRows.length ? liveRows.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a)) : null;
  const recCounts = liveRows.reduce<Record<string, number>>((acc, s) => {
    if (s.recommendation) acc[s.recommendation] = (acc[s.recommendation] || 0) + 1;
    return acc;
  }, {});
  const topRec = Object.entries(recCounts).sort((a, b) => b[1] - a[1])[0];

  const KPI_DATA = [
    { label: "Signals Live", value: liveRows.length.toLocaleString(), change: `${signals.length - liveRows.length} failed`, up: true },
    { label: "Avg Confidence", value: liveRows.length ? `${avgConfidence.toFixed(1)}%` : "—", change: "computed", up: true },
    { label: "Strongest", value: best ? `${best.token} ${(best.score || 0).toFixed(1)}` : "—", change: best?.recommendation?.replace("_", " ") || "—", up: true },
    { label: "Consensus", value: topRec ? topRec[0].replace("_", " ") : "—", change: `${topRec ? topRec[1] : 0} tokens`, up: true },
  ];

  const filtered = signals.filter((s) => s.token?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-sf-muted">Multi-signal composite scores from live Binance market data</p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-sf-muted font-mono animate-pulse">fetching live data…</span>
          ) : (
            <span className="text-xs text-green-400 font-mono">● live</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {KPI_DATA.map((kpi) => (
          <div key={kpi.label} className="card p-3">
            <p className="text-[10px] text-sf-muted uppercase tracking-wider">{kpi.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold font-mono truncate">{kpi.value}</span>
              <span className={clsx("text-[11px] font-mono", kpi.up ? "text-sf-accent" : "text-sf-muted")}>
                {kpi.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 card">
          <div className="p-3 border-b border-sf-border flex items-center justify-between">
            <h2 className="text-sm font-medium">Signal Scores</h2>
            <input
              type="text"
              placeholder="Filter token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-sf-bg border border-sf-border rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-sf-accent"
            />
          </div>
          {error && (
            <div className="p-3 text-xs text-sf-danger font-mono">
              {error} — <button onClick={loadSignals} className="underline">retry</button>
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-xs text-sf-muted">Loading live signals…</div>
          ) : (
            <div className="divide-y divide-sf-border">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-sf-muted uppercase tracking-wider">
                <div className="col-span-2">Token</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-3">Recommendation</div>
                <div className="col-span-2">Confidence</div>
                <div className="col-span-3">Sub-Signals</div>
              </div>
              {filtered.map((s) =>
                s.error ? (
                  <div key={s.token} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm">
                    <div className="col-span-2 font-mono font-medium">{s.token}</div>
                    <div className="col-span-10 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-500/15 text-orange-400 shrink-0">
                        unavailable
                      </span>
                      <span className="col-span-2 text-xs font-mono text-sf-danger truncate" aria-live="polite">
                        {s.error}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={s.token}
                    className={clsx(
                      "grid grid-cols-12 gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors",
                      selected?.token === s.token ? "bg-sf-bg" : "hover:bg-sf-bg/50"
                    )}
                    onClick={() => loadDetail(s.token)}
                  >
                    <div className="col-span-2 font-mono font-medium">{s.token}</div>
                    <div className={clsx("col-span-2 font-mono font-semibold", SCORE_COLOR(s.score || 0))}>
                      {s.score?.toFixed(1) ?? "—"}
                    </div>
                    <div className="col-span-3">
                      {s.recommendation ? (
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-medium", REC_BADGE[s.recommendation])}>
                          {s.recommendation.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-sf-muted">—</span>
                      )}
                    </div>
                    <div className="col-span-2 font-mono text-sf-muted text-xs">
                      {s.confidence != null ? `${(s.confidence * 100).toFixed(0)}%` : "—"}
                    </div>
                    <div className="col-span-3 space-y-0.5">
                      {s.sub_signals?.slice(0, 3).map((ss) => (
                        <SubSignalBar key={ss.name} name={ss.name} value={ss.value} />
                      ))}
                    </div>
                  </div>
                )
              )}
              {!filtered.length && (
                <div className="p-6 text-center text-xs text-sf-muted">No signals match “{search}”</div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {selected ? (
            <div className="card p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{selected.token} Signal Breakdown</h3>
                  {selected.recommendation ? (
                    <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", REC_BADGE[selected.recommendation])}>
                      {selected.recommendation.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-400">unavailable</span>
                  )}
                </div>
                {selected.error ? (
                  <p className="text-xs font-mono text-sf-danger" aria-live="polite">
                    {selected.error}. Try another token or retry in a moment.
                  </p>
                ) : (
                  <>
                    <div className="text-center mb-4">
                      <span className={clsx("text-4xl font-bold font-mono", SCORE_COLOR(selected.score || 0))}>
                        {(selected.score ?? 0).toFixed(1)}
                      </span>
                      <p className="text-[10px] text-sf-muted mt-0.5">COMPOSITE SCORE</p>
                      {selected.price != null && (
                        <p className="text-[11px] font-mono text-sf-muted mt-0.5">${selected.price.toLocaleString()}</p>
                      )}
                      {selected.sub_signals != null && (
                        <p className="text-[10px] font-mono text-sf-muted mt-1">
                          {selected.sub_signals.filter((ss) => ss.available).length}/{selected.sub_signals.length} signals live
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-sf-muted uppercase tracking-wider">Signal Breakdown</p>
                      {selected.sub_signals?.map((ss) => (
                        <div key={ss.name} className="space-y-0.5">
                          <SubSignalBar name={ss.name} value={ss.value} />
                        </div>
                      ))}
                      <div className="pt-2">
                        {selected.sub_signals?.map((ss) => (
                          <p key={ss.name} className="text-[10px] text-sf-muted leading-relaxed">
                            <span className="text-sf-border">{ss.name.replace("_", " ")}:</span> {ss.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-4 flex items-center justify-center h-48">
              <p className="text-xs text-sf-muted">Click a token to view breakdown</p>
            </div>
          )}

          <div className="card p-3">
            <p className="text-[10px] text-sf-muted uppercase tracking-wider mb-2">Quick Signal</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token (e.g. BTC)"
                value={quickToken}
                maxLength={10}
                onChange={(e) => setQuickToken(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleQuickSignal()}
                className="flex-1 bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sf-accent"
              />
              <button
                onClick={handleQuickSignal}
                disabled={quickLoading || !quickToken.trim()}
                className="bg-sf-accent text-sf-bg text-xs font-medium px-3 py-1.5 rounded hover:bg-sf-accent/90 transition-colors disabled:opacity-50"
              >
                {quickLoading ? "…" : "Get Signal"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}