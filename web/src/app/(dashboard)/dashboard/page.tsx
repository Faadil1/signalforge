"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Search, RefreshCw } from "lucide-react";
import { fetchTickers, isSignalOk, safeJson, type MarketCards, type SignalCard, type SubSignal, type Ticker } from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { PageHeader } from "@/components/layout/PageHeader";
import { PriceTicker } from "@/components/market/PriceTicker";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SignalCard as SignalCardView } from "@/components/signal/SignalCard";
import { RecommendationBadge } from "@/components/signal/RecommendationBadge";
import { ScoreGauge } from "@/components/charts/ScoreGauge";

const POLL_MS = 10_000;
const TICKER_POLL_MS = 4_000;

type SignalRow = {
  token: string;
  price?: number;
  score?: number;
  confidence?: number;
  recommendation?: string;
  sub_signals?: SubSignal[];
  provider?: string;
  sources?: Record<string, string>;
  coverage?: number;
  actionability?: string;
  executionAuthorized?: boolean;
  error?: string;
};

function cardToRow(card: SignalCard): SignalRow {
  if (isSignalOk(card)) {
    return {
      token: card.token,
      price: card.price,
      score: card.score,
      confidence: card.confidence,
      recommendation: card.recommendation,
      sub_signals: card.sub_signals,
      provider: card.source_meta?.provider,
      sources: card.source_meta?.sources,
      coverage: card.coverage,
      actionability: card.actionability,
      executionAuthorized: card.execution_authorized,
    };
  }
  return { token: card.token, error: card.error.message };
}

function secondsAgo(date: Date | null): string | null {
  if (!date) return null;
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "Multi-provider public";
  if (provider === "binance_public") return "Binance public";
  if (provider === "coinbase_exchange") return "Coinbase Exchange";
  if (provider === "mock") return "Mock";
  return "Explicit provenance";
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const [quickToken, setQuickToken] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [, setNow] = useState(Date.now());

  useInterval(() => setNow(Date.now()), 1000);

  const pollTickers = useCallback(async () => {
    const ts = await fetchTickers();
    if (ts.length) setTickers(ts);
  }, []);

  useEffect(() => {
    pollTickers();
  }, [pollTickers]);

  useInterval(pollTickers, TICKER_POLL_MS);

  const loadSignals = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/v1/overview");
      const data = await safeJson<MarketCards>(res, { market_cards: [] });
      setSignals((data.market_cards || []).map(cardToRow));
      setLastUpdated(new Date());
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  useInterval(() => {
    const silent = () => loadSignals({ silent: true });
    silent();
  }, POLL_MS);

  const loadDetail = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/v1/signal/${token}`);
      const card = await safeJson<SignalCard>(res, {
        ok: false,
        token,
        error: { code: "UNPARSEABLE", message: "Unexpected response" },
      });
      const row = cardToRow(card);
      setSignals((prev) => {
        const idx = prev.findIndex((s) => s.token === row.token);
        if (idx === -1) return [...prev, row];
        const next = [...prev];
        next[idx] = row;
        return next;
      });
      setSelected(row);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load ${token}, try again.`);
    } finally {
      setQuickLoading(false);
    }
  }, []);

  useInterval(() => {
    if (selected?.token) loadDetail(selected.token);
  }, selected?.token ? POLL_MS : null);

  const handleQuickSignal = () => {
    const token = quickToken.trim().toUpperCase();
    if (!token) return;
    setQuickLoading(true);
    loadDetail(token);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSignals();
  };

  const liveRows = signals.filter((s) => s.score !== undefined && !s.error);
  const tickerByToken = new Map(tickers.map((t) => [t.token, t]));
  const avgConfidence = liveRows.length
    ? (liveRows.reduce((acc, s) => acc + (s.confidence || 0), 0) / liveRows.length) * 100
    : 0;
  const best = liveRows.length ? liveRows.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a)) : null;
  const recCounts = liveRows.reduce<Record<string, number>>((acc, s) => {
    if (s.recommendation) acc[s.recommendation] = (acc[s.recommendation] || 0) + 1;
    return acc;
  }, {});
  const topRec = Object.entries(recCounts).sort((a, b) => b[1] - a[1])[0];
  const observedProvider = liveRows.find((row) => row.provider)?.provider;

  const KPI_DATA = [
    { label: "Markets Loaded", value: liveRows.length.toLocaleString(), change: `${signals.length - liveRows.length} unavailable` },
    { label: "Avg Confidence", value: liveRows.length ? `${avgConfidence.toFixed(1)}%` : "—", change: "evidence-weighted" },
    { label: "Strongest", value: best ? `${best.token} ${(best.score || 0).toFixed(1)}` : "—", change: best?.recommendation?.replace("_", " ") || "—" },
    { label: "Provider", value: providerLabel(observedProvider), change: "per-source provenance below" },
  ];

  const filtered = signals.filter((s) => s.token?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Overview"
        subtitle="Evidence-gated composite scores with explicit per-source provenance"
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={loading ? "stale" : error ? "error" : "live"} label={loading ? "Loading" : error ? "Error" : "Auto-refreshing"} />
            <span className="hidden text-xs text-text-subtle sm:inline">
              updated {secondsAgo(lastUpdated) ?? "…"}
            </span>
          </div>
        }
        actions={
          <Button size="md" variant="secondary" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI_DATA.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-text-subtle">{kpi.label}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-text">{kpi.value}</p>
            <p className="mt-0.5 text-[11px] text-text-subtle">{kpi.change}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signal Scores</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                type="text"
                placeholder="Filter token…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-sm pl-8 w-40 md:w-52"
              />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {error && (
              <div className="mx-4 mt-4 rounded-md bg-negative/10 p-3 text-xs text-negative font-mono">
                {error} — <button onClick={() => loadSignals()} className="underline">retry</button>
              </div>
            )}
            {loading ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-12 gap-2 border-b border-border px-5 py-2 text-[10px] uppercase tracking-wider text-text-subtle">
                  <div className="col-span-2">Token</div>
                  <div className="col-span-2">Score</div>
                  <div className="col-span-3">Recommendation</div>
                  <div className="col-span-2">Confidence</div>
                  <div className="col-span-3">Evidence</div>
                </div>
                {filtered.map((s) =>
                  s.error ? (
                    <div key={s.token} className="grid grid-cols-12 gap-2 border-b border-border px-5 py-3 text-sm">
                      <div className="col-span-2 font-mono font-medium">{s.token}</div>
                      <div className="col-span-10 flex items-center gap-2">
                        <Badge tone="warning">unavailable</Badge>
                        <span className="truncate text-xs font-mono text-negative" aria-live="polite">{s.error}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={s.token}
                      className={clsx(
                        "grid cursor-pointer grid-cols-12 gap-2 border-b border-border px-5 py-3 text-sm transition-colors last:border-0",
                        selected?.token === s.token ? "bg-surface-secondary" : "hover:bg-surface-secondary/60"
                      )}
                      onClick={() => loadDetail(s.token)}
                    >
                      <div className="col-span-2">
                        <div className="font-mono font-medium text-text">{s.token}</div>
                        <PriceTicker
                          price={tickerByToken.get(s.token)?.price ?? s.price}
                          changePct={tickerByToken.get(s.token)?.price_change_pct}
                          className="text-xs text-text-subtle"
                        />
                      </div>
                      <div className="col-span-2 font-mono font-semibold tabular-nums text-text">{s.score?.toFixed(1) ?? "—"}</div>
                      <div className="col-span-3">
                        {s.recommendation ? <RecommendationBadge recommendation={s.recommendation} /> : <span className="text-xs">—</span>}
                      </div>
                      <div className="col-span-2 font-mono text-xs text-text-secondary">
                        {s.confidence != null ? `${(s.confidence * 100).toFixed(0)}%` : "—"}
                      </div>
                      <div className="col-span-3 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-text-subtle">
                          <span>{Math.round((s.coverage ?? 0) * 100)}% coverage</span>
                          <span>{providerLabel(s.provider)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(s.sources || {}).map(([name, source]) => (
                            <span key={name} className={clsx(
                              "rounded px-1.5 py-0.5 font-mono text-[9px]",
                              source === "unavailable" ? "bg-surface-secondary text-text-subtle" : "bg-brand/10 text-brand"
                            )}>
                              {name.replace("open_interest", "oi")}: {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                )}
                {!filtered.length && <div className="p-6 text-center text-xs text-text-subtle">No signals match “{search}”</div>}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          {selected?.error ? (
            <Card className="p-6 text-center">
              <p className="font-mono text-xs text-negative" aria-live="polite">{selected.error}</p>
              <p className="mt-2 text-xs text-text-subtle">Try another token or retry in a moment.</p>
            </Card>
          ) : selected ? (
            <Card>
              <CardBody>
                <div className="text-center">
                  <ScoreGauge score={selected.score} />
                  <RecommendationBadge recommendation={selected.recommendation} />
                  {selected.price != null && (
                    <PriceTicker
                      price={tickerByToken.get(selected.token)?.price ?? selected.price}
                      changePct={tickerByToken.get(selected.token)?.price_change_pct}
                      className="mt-3 justify-center text-sm text-text-secondary"
                    />
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-text-subtle">
                    <span>{Math.round((selected.coverage ?? 0) * 100)}% evidence coverage</span>
                    <span>·</span>
                    <span>execution unauthorized</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card className="flex h-48 items-center justify-center">
              <p className="text-xs text-text-subtle">Click a token to view its breakdown</p>
            </Card>
          )}

          <div className="space-y-3">
            {selected?.sub_signals?.map((ss) => (
              <SignalCardView
                key={ss.name}
                name={ss.name}
                value={ss.value}
                direction={ss.value >= 60 ? "positive" : ss.value >= 40 ? "neutral" : "negative"}
                explanation={ss.reason}
                confidence={ss.confidence}
                available={ss.available}
              />
            ))}
          </div>

          <Card>
            <CardBody className="p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-subtle">Quick Signal</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter token (e.g. BTC)"
                  value={quickToken}
                  maxLength={10}
                  onChange={(e) => setQuickToken(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSignal()}
                  className="input-sm"
                />
                <Button size="sm" onClick={handleQuickSignal} disabled={quickLoading || !quickToken.trim()}>
                  {quickLoading ? "…" : "Get"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
