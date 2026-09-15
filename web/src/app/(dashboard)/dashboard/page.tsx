"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Crosshair, RefreshCw, Search, ArrowUpRight, Layers3 } from "lucide-react";
import {
  fetchTickers,
  isSignalOk,
  safeJson,
  type MarketCards,
  type SignalCard,
  type SubSignal,
  type Ticker,
} from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { PriceTicker } from "@/components/market/PriceTicker";
import { RecommendationBadge } from "@/components/signal/RecommendationBadge";
import { Button } from "@/components/ui/Button";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { EvidenceRail } from "@/components/atlas/EvidenceRail";
import { ActionabilityGate } from "@/components/atlas/ActionabilityGate";

const POLL_MS = 10_000;
const TICKER_POLL_MS = 4_000;

type SignalRow = {
  token: string;
  price?: number;
  score?: number;
  confidence?: number;
  recommendation?: string;
  subSignals?: SubSignal[];
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
      subSignals: card.sub_signals,
      provider: card.source_meta?.provider,
      sources: card.source_meta?.sources,
      coverage: card.coverage,
      actionability: card.actionability,
      executionAuthorized: card.execution_authorized,
    };
  }
  return { token: card.token, error: card.error.message };
}

function secondsAgo(date: Date | null): string {
  if (!date) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "NOW";
  if (seconds < 60) return `${seconds}S`;
  return `${Math.round(seconds / 60)}M`;
}

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "MULTI-PROVIDER";
  if (provider === "binance_public") return "BINANCE PUBLIC";
  if (provider === "coinbase_exchange") return "COINBASE";
  if (provider === "mock") return "MOCK";
  return "PROVENANCE PENDING";
}

function scoreTone(score?: number) {
  if (score == null) return "text-text-subtle";
  if (score >= 60) return "text-positive";
  if (score < 40) return "text-negative";
  return "text-text";
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [search, setSearch] = useState("");
  const [quickToken, setQuickToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setNow] = useState(Date.now());

  useInterval(() => setNow(Date.now()), 1000);

  const pollTickers = useCallback(async () => {
    const next = await fetchTickers();
    if (next.length) setTickers(next);
  }, []);

  useEffect(() => {
    void pollTickers();
  }, [pollTickers]);
  useInterval(pollTickers, TICKER_POLL_MS);

  const loadSignals = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await fetch("/api/v1/overview");
      const data = await safeJson<MarketCards>(response, { market_cards: [] });
      const rows = (data.market_cards || []).map(cardToRow);
      setSignals(rows);
      setSelected((previous) => {
        if (previous) return rows.find((row) => row.token === previous.token) || previous;
        return rows.find((row) => row.score != null && !row.error) || null;
      });
      setLastUpdated(new Date());
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Observation field unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSignals();
  }, [loadSignals]);
  useInterval(() => void loadSignals(true), POLL_MS);

  const loadDetail = useCallback(async (token: string) => {
    try {
      const response = await fetch(`/api/v1/signal/${token}`);
      const card = await safeJson<SignalCard>(response, {
        ok: false,
        token,
        error: { code: "UNPARSEABLE", message: "Unexpected response" },
      });
      const row = cardToRow(card);
      setSelected(row);
      setSignals((previous) => {
        const index = previous.findIndex((item) => item.token === row.token);
        if (index === -1) return [...previous, row];
        const next = [...previous];
        next[index] = row;
        return next;
      });
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to inspect ${token}`);
    }
  }, []);

  const tickerByToken = useMemo(() => new Map(tickers.map((ticker) => [ticker.token, ticker])), [tickers]);
  const liveRows = signals.filter((row) => row.score != null && !row.error);
  const filtered = signals.filter((row) => row.token.toLowerCase().includes(search.toLowerCase()));
  const averageCoverage = liveRows.length ? liveRows.reduce((sum, row) => sum + (row.coverage || 0), 0) / liveRows.length : 0;
  const averageConfidence = liveRows.length ? liveRows.reduce((sum, row) => sum + (row.confidence || 0), 0) / liveRows.length : 0;
  const provider = liveRows.find((row) => row.provider)?.provider;

  const inspectQuick = () => {
    const token = quickToken.trim().toUpperCase();
    if (!token) return;
    void loadDetail(token);
  };

  return (
    <div className="space-y-5">
      <header className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="field-label">01 / OBSERVATION FIELD</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-text md:text-5xl">Market evidence, under load.</h1>
            <span className="atlas-stamp atlas-stamp-live">AUTO REFRESH / {secondsAgo(lastUpdated)}</span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
            Composite market observations with source provenance, exclusion states and actionability boundaries exposed in the same frame.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { setRefreshing(true); void loadSignals(); }} loading={refreshing}>
          <RefreshCw className="h-4 w-4" /> Re-scan field
        </Button>
      </header>

      <div className="survey-strip">
        <div className="survey-cell col-span-6 sm:col-span-3"><p className="atlas-micro">markets loaded</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{liveRows.length}</p></div>
        <div className="survey-cell col-span-6 sm:col-span-3"><p className="atlas-micro">mean coverage</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{Math.round(averageCoverage * 100)}%</p></div>
        <div className="survey-cell col-span-6 sm:col-span-3"><p className="atlas-micro">mean confidence</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{Math.round(averageConfidence * 100)}%</p></div>
        <div className="survey-cell col-span-6 sm:col-span-3"><p className="atlas-micro">active provider</p><p className="mt-1 font-mono text-[12px] font-semibold text-text">{providerLabel(provider)}</p></div>
      </div>

      {error && <div className="border border-negative/40 bg-negative/5 px-4 py-3 font-mono text-[11px] text-negative">FIELD ERROR / {error}</div>}

      <div className="grid gap-5 xl:grid-cols-12">
        <AtlasPanel label="Market Strata" code="FIELD-A" meta={`${filtered.length} records`} className="xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input className="input-sm pl-9" placeholder="filter market" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="field-label">click row to inspect evidence packet</div>
          </div>

          <div className="border-y border-border">
            <div className="hidden grid-cols-[80px_1fr_96px_140px_110px] gap-3 border-b border-border py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-text-subtle md:grid">
              <span>market</span><span>evidence contour</span><span>score</span><span>stance</span><span>coverage</span>
            </div>
            {loading && !signals.length ? (
              <div className="space-y-2 py-4">{[0,1,2,3].map((index) => <div key={index} className="skeleton h-16 w-full" />)}</div>
            ) : filtered.map((row, index) => {
              const active = selected?.token === row.token;
              const usable = row.subSignals?.filter((signal) => signal.available) || [];
              return (
                <button
                  key={row.token}
                  type="button"
                  onClick={() => !row.error && void loadDetail(row.token)}
                  className={clsx(
                    "grid w-full gap-3 border-b border-border py-4 text-left transition-colors last:border-b-0 md:grid-cols-[80px_1fr_96px_140px_110px] md:items-center",
                    active ? "bg-brand/[0.055]" : "hover:bg-surface-secondary/45",
                    row.error && "cursor-not-allowed opacity-55"
                  )}
                >
                  <div className="px-2 md:px-0">
                    <p className="font-mono text-[9px] text-text-subtle">0{index + 1}</p>
                    <p className="mt-1 font-mono text-base font-semibold text-text">{row.token}</p>
                    <PriceTicker price={tickerByToken.get(row.token)?.price ?? row.price} changePct={tickerByToken.get(row.token)?.price_change_pct} className="text-[10px] text-text-subtle" />
                  </div>
                  <div className="px-2 md:px-0">
                    {row.error ? <p className="font-mono text-[10px] text-negative">UNAVAILABLE / {row.error}</p> : (
                      <div className="grid grid-cols-5 gap-1">
                        {(row.subSignals || []).map((signal) => (
                          <div key={signal.name} className={clsx("h-7 border", signal.available ? "border-brand/30 bg-brand/[0.06]" : "border-dashed border-border bg-surface-secondary/50")} title={`${signal.name}: ${signal.available ? signal.value : "excluded"}`}>
                            <div className={clsx("h-full origin-bottom transition-transform", signal.available ? "bg-brand/18" : "bg-transparent")} style={{ transform: `scaleY(${signal.available ? Math.max(0.08, Math.min(1, signal.value / 100)) : 0.08})` }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {!row.error && <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle">{usable.length}/5 channels used · {providerLabel(row.provider)}</p>}
                  </div>
                  <p className={clsx("px-2 font-mono text-3xl font-semibold md:px-0", scoreTone(row.score))}>{row.score?.toFixed(0) ?? "—"}</p>
                  <div className="px-2 md:px-0">{row.recommendation ? <RecommendationBadge recommendation={row.recommendation} /> : <span className="atlas-micro">—</span>}</div>
                  <div className="px-2 md:px-0"><p className="font-mono text-sm font-semibold text-text">{Math.round((row.coverage || 0) * 100)}%</p><p className="atlas-micro">confidence {Math.round((row.confidence || 0) * 100)}%</p></div>
                </button>
              );
            })}
          </div>
        </AtlasPanel>

        <div className="space-y-5 xl:col-span-4">
          <AtlasPanel label="Decision Core" code="FIELD-B" tone={selected?.actionability === "insufficient_evidence" ? "critical" : "live"} meta={selected?.token || "none"}>
            {selected && !selected.error ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="atlas-micro">selected market</p><p className="mt-2 font-mono text-2xl font-semibold text-text">{selected.token}</p></div>
                  {selected.recommendation && <RecommendationBadge recommendation={selected.recommendation} />}
                </div>
                <div className="my-8 grid grid-cols-[1fr_auto] items-end gap-4 border-y border-border py-6">
                  <div><p className="atlas-micro">composite</p><p className={clsx("decision-score mt-3 font-mono text-[92px] font-semibold", scoreTone(selected.score))}>{selected.score?.toFixed(0)}</p></div>
                  <Crosshair className="mb-2 h-10 w-10 text-brand/60" />
                </div>
                <ActionabilityGate actionability={selected.actionability} coverage={selected.coverage} confidence={selected.confidence} executionAuthorized={selected.executionAuthorized} />
              </>
            ) : (
              <div className="flex min-h-72 items-center justify-center text-center"><div><Crosshair className="mx-auto h-7 w-7 text-text-subtle" /><p className="mt-4 text-xs text-text-subtle">Select an observed market to open its decision core.</p></div></div>
            )}
          </AtlasPanel>

          <AtlasPanel label="Quick Inspect" code="FIELD-C" tone="quiet">
            <div className="flex gap-2">
              <input className="input-sm font-mono" value={quickToken} maxLength={12} placeholder="BTC" onChange={(event) => setQuickToken(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && inspectQuick()} />
              <Button size="sm" onClick={inspectQuick}><ArrowUpRight className="h-4 w-4" /> Inspect</Button>
            </div>
          </AtlasPanel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <EvidenceRail sources={selected?.sources} coverage={selected?.coverage} />
        </div>
        <AtlasPanel label="Field Reading" code="FIELD-D" tone="quiet" className="xl:col-span-4">
          <div className="flex items-start gap-3"><Layers3 className="mt-0.5 h-5 w-5 text-brand" /><div><p className="text-sm font-semibold text-text">Evidence is allowed to remain incomplete.</p><p className="mt-2 text-xs leading-5 text-text-secondary">The interface treats missing funding or open-interest as excluded evidence, not as a neutral score. Coverage and confidence stay visible beside the conclusion.</p></div></div>
        </AtlasPanel>
      </div>
    </div>
  );
}
