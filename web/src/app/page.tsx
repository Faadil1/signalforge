"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Activity,
  TrendingUp,
  BarChart3,
  Waves,
  Zap,
  Gauge,
  Radio,
  ShieldCheck,
  Keyboard,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  isSignalOk,
  safeJson,
  fetchTickers,
  type MarketCards,
  type SignalCard,
  type SignalOk,
  type SignalResponse,
  type SignalsMetaResponse,
  type Ticker,
} from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { PriceTicker } from "@/components/market/PriceTicker";
import { RecommendationBadge } from "@/components/signal/RecommendationBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

const POLL_MS = 10_000;
const TICKER_POLL_MS = 4_000;

const EMPTY_META: SignalsMetaResponse = {
  signal_count: 0,
  total_weight: 0,
  signals: [],
  recommendation_thresholds: [],
};

const UNPARSEABLE: (token: string) => SignalResponse = (token) => ({
  ok: false,
  token,
  error: { code: "UNPARSEABLE", message: "Unexpected response" },
});

function buildSampleJson(sig: SignalOk): string {
  return JSON.stringify(
    {
      token: sig.token,
      price: sig.price,
      score: sig.score,
      recommendation: sig.recommendation,
      confidence: sig.confidence,
      coverage: sig.coverage,
      sub_signals: sig.sub_signals.map((s) => ({
        name: s.name,
        value: s.value,
        confidence: s.confidence,
      })),
    },
    null,
    2
  );
}

function secondsAgo(date: Date | null): string | null {
  if (!date) return null;
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

const SIGNAL_ICONS: Record<string, LucideIcon> = {
  technical: Activity,
  trend: TrendingUp,
  funding: Radio,
  open_interest: BarChart3,
  volume: Waves,
};

const FALLBACK_ICON: LucideIcon = Activity;

const THRESHOLD_TONE: Record<string, { tone: "positive" | "neutral" | "warning" | "negative"; label: string }> = {
  strong_buy: { tone: "positive", label: "strong buy" },
  buy: { tone: "positive", label: "buy" },
  hold: { tone: "neutral", label: "hold" },
  sell: { tone: "warning", label: "sell" },
  strong_sell: { tone: "negative", label: "strong sell" },
};

function barTone(value: number): string {
  if (value >= 60) return "bg-positive";
  if (value >= 40) return "bg-text-secondary";
  return "bg-negative";
}

export default function LandingPage() {
  const [overview, setOverview] = useState<SignalCard[]>([]);
  const [meta, setMeta] = useState<SignalsMetaResponse | null>(null);
  const [featured, setFeatured] = useState<SignalOk | null>(null);
  const [featuredToken, setFeaturedToken] = useState<string | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [sampleJson, setSampleJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [, setNow] = useState(Date.now());
  const didLoad = useRef(false);

  useInterval(() => setNow(Date.now()), 1000);

  const pollTickers = useCallback(async () => {
    const ts = await fetchTickers();
    if (ts.length) setTickers(ts);
  }, []);

  useEffect(() => {
    pollTickers();
  }, [pollTickers]);

  useInterval(pollTickers, TICKER_POLL_MS);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [metaRes, ovRes] = await Promise.all([
          fetch("/api/v1/signals/meta"),
          fetch("/api/v1/overview"),
        ]);
        const m = await safeJson<SignalsMetaResponse>(metaRes, EMPTY_META);
        const ov = await safeJson<MarketCards>(ovRes, { market_cards: [] });
        if (cancelled) return;
        setMeta(m);
        setOverview(ov.market_cards || []);
        setLastUpdated(new Date());
      } catch {
        if (!cancelled) setError("Live market data temporarily unavailable.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pollOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/overview");
      const ov = await safeJson<MarketCards>(res, { market_cards: [] });
      if (ov.market_cards && ov.market_cards.length > 0) {
        setOverview(ov.market_cards);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch {
      // keep last good snapshot on transient failure
    }
  }, []);

  useInterval(pollOverview, POLL_MS);

  const loadFeatured = useCallback(async (token: string, silent = false) => {
    if (!silent) setFeaturedLoading(true);
    try {
      const res = await fetch(`/api/v1/signal/${token}`);
      const sig = await safeJson<SignalResponse>(res, UNPARSEABLE(token));
      if (isSignalOk(sig)) {
        setFeatured(sig);
        setSampleJson(buildSampleJson(sig));
        setLastUpdated(new Date());
      } else {
        setError("Deep-dive signal unavailable.");
      }
    } catch {
      setError("Deep-dive signal unavailable.");
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  useInterval(() => {
    if (featuredToken && !error) loadFeatured(featuredToken, true);
  }, featuredToken && !error ? POLL_MS : null);

  useEffect(() => {
    if (featuredToken || overview.length === 0 || didLoad.current === false) return;
    const firstOk = overview.find((s) => s.ok === true && s.token) as SignalOk | undefined;
    const token = firstOk?.token;
    if (!token) return;
    setFeaturedToken(token);
    loadFeatured(token);
  }, [overview, featuredToken, loadFeatured]);

  const live = overview.filter((s): s is SignalOk => s.ok === true && !!s.token);
  const tickerByToken = new Map(tickers.map((t) => [t.token, t]));
  const metaName = (key: string) => {
    const found = meta?.signals.find((s) => s.key === key);
    return found?.name || key.replace(/_/g, " ");
  };

  const copyCurl = async () => {
    const token = featured?.token ?? "BTC";
    try {
      await navigator.clipboard.writeText(`curl "http://localhost:8000/api/v1/signal/${token}"`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="min-h-screen bg-surface-app">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="hidden items-center gap-6 md:flex">
            <a href="#engine" className="text-sm font-medium text-text-secondary hover:text-text">Signal Engine</a>
            <a href="#explain" className="text-sm font-medium text-text-secondary hover:text-text">Explainability</a>
            <a href="#agent" className="text-sm font-medium text-text-secondary hover:text-text">Agent API</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-sm font-medium text-text-secondary hover:text-text">View GitHub</a>
            <Link href="/dashboard">
              <Button size="md" className="ml-2">Launch App</Button>
            </Link>
          </div>
          <Link href="/dashboard" className="md:hidden">
            <Button size="sm">Launch</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Badge tone="brand" className="mb-5">
              <Zap className="h-3.5 w-3.5" /> X-Agent AI MCP Hackathon 2026
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-text md:text-6xl">
              Market intelligence
              <br />
              your agent can act on.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-secondary">
              SignalForge fuses technical structure, trend, funding, open interest and volume into
              one explainable signal — available through a visual workspace and an agent-ready API.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/dashboard">
                <Button size="lg">Explore live signals <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <a href="#agent">
                <Button size="lg" variant="secondary">Test the API</Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-positive" /> Live market data</span>
              <span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-positive" /> Explainable scoring</span>
              <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-positive" /> Agent-ready</span>
            </div>
          </motion.div>

          {/* Live preview panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="card p-6 shadow-drawer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-positive" />
                <span className="text-xs font-mono text-positive">LIVE MARKET DATA</span>
                <span className="text-xs text-text-subtle">updated {secondsAgo(lastUpdated) ?? "…"}</span>
              </div>
              {error && <span className="text-xs text-negative">{error}</span>}
            </div>
            <div className="mt-4 space-y-4">
              {live.length ? (
                live.map((row) => (
                  <div key={row.token} className="flex items-center justify-between rounded-lg bg-surface-secondary p-4">
                    <div>
                      <p className="font-mono text-sm font-semibold text-text">{row.token}</p>
                      <PriceTicker
                        price={tickerByToken.get(row.token)?.price ?? row.price}
                        changePct={tickerByToken.get(row.token)?.price_change_pct}
                        className="text-xs text-text-subtle"
                      />
                    </div>
                    <RecommendationBadge recommendation={row.recommendation ?? ""} />
                    <div className="text-right">
                      <p className="font-mono text-xl font-bold tabular-nums text-text">{(row.score ?? 0).toFixed(1)}</p>
                      <p className="text-[11px] text-text-subtle">Composite</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-surface-secondary p-4">
                      <div className="skeleton h-4 w-12" />
                      <div className="skeleton h-4 w-24" />
                      <div className="skeleton h-8 w-14" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-text-subtle">
              <span>{meta?.signal_count || 5} signals · one score</span>
              <a href="/dashboard" className="flex items-center gap-1 font-medium text-brand hover:text-brand-hover">
                Open dashboard <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Fusion Engine */}
      <section id="engine" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Signal Fusion</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">
              {meta?.signal_count || "Five"} signals. One explainable number.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-text-secondary">
              Each live signal is normalized to 0-100, weighted by reliability, and fused into a single composite score.
            </p>
          </div>

          {meta?.signals.length ? (
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {meta.signals.map((s) => {
                  const Icon = SIGNAL_ICONS[s.key] || FALLBACK_ICON;
                  return (
                    <div key={s.key} className="card p-4 card-hover">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-5 w-5 text-brand" />
                          <span className="text-sm font-semibold text-text">{s.name}</span>
                        </div>
                        <span className="font-mono text-sm text-text-subtle">{Math.round(s.weight * 100)}%</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{s.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="hidden justify-center md:flex">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>

              <div className="card p-8 text-center shadow-drawer">
                <p className="text-sm font-medium text-text-subtle">Weighted fusion</p>
                <div className="mt-3 flex items-center justify-center gap-4">
                  <Gauge className="h-8 w-8 text-brand" />
                  <p className="text-5xl font-bold tabular-nums text-text">{meta.total_weight.toFixed(2)}</p>
                </div>
                <p className="mt-3 text-sm text-text-secondary">Total signal weight</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {meta.recommendation_thresholds.map((t) => {
                    const cfg = THRESHOLD_TONE[t.recommendation] || { tone: "neutral", label: t.recommendation };
                    return (
                      <Badge key={t.recommendation} tone={cfg.tone}>
                        {t.min_score.toFixed(0)}–{t.max_score.toFixed(0)} · {cfg.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="skeleton h-32 w-full max-w-2xl rounded-lg" />
            </div>
          )}
        </div>
      </section>

      {/* Explainability */}
      <section id="explain" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Explainability</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">
              A recommendation you can interrogate.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
              Every score is traceable. SignalForge exposes the contributing signals, weights, confidence,
              data coverage, and human-readable reasons behind each recommendation — so agents and users
              understand <em>why</em>, not just <em>what</em>.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-text-secondary">
              {[
                "Composite score with confidence",
                "Per-signal breakdown and weights",
                "Data coverage and freshness",
                "Plain-language explanations",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-positive" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6 shadow-drawer">
            {featured ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold text-text">{featured.token}</p>
                    <p className="text-xs text-text-subtle">
                      {featured.available_signals}/{featured.total_signals} signals live · coverage {(featured.coverage * 100).toFixed(0)}%
                    </p>
                  </div>
                  <RecommendationBadge recommendation={featured.recommendation} />
                </div>
                <div className="mt-4 text-center">
                  <p className="font-mono text-5xl font-bold tabular-nums text-text">{featured.score.toFixed(0)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-text-subtle">
                    Composite Score · conf {(featured.confidence * 100).toFixed(0)}%
                  </p>
                  {featured.price != null && (
                    <PriceTicker
                      price={tickerByToken.get(featured.token)?.price ?? featured.price}
                      changePct={tickerByToken.get(featured.token)?.price_change_pct}
                      className="mt-1 justify-center text-xs text-text-subtle"
                    />
                  )}
                </div>
                <div className="mt-5 space-y-2.5">
                  {featured.sub_signals.map((s) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <span className="w-28 truncate text-xs text-text-secondary">{metaName(s.name)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                        <div className={`h-full rounded-full ${barTone(s.value)}`} style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }} />
                      </div>
                      <span className="w-8 text-right font-mono text-xs text-text-secondary">{s.value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : featuredLoading ? (
              <div className="space-y-4">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton mx-auto h-16 w-20" />
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-2.5 w-full" />)}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center">
                {error ? (
                  <p className="text-xs text-negative">{error}</p>
                ) : (
                  <div className="skeleton h-40 w-full rounded-lg" />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Agent-native */}
      <section id="agent" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Agent-native</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">
              Built for applications. Structured for agents.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-text-secondary">
              Pull a single token or the whole market with one typed call. Every endpoint returns clean,
              structured JSON that agents can act on directly.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-negative/40" />
                <span className="h-3 w-3 rounded-full bg-warning/40" />
                <span className="h-3 w-3 rounded-full bg-positive/40" />
                <span className="ml-2 font-mono text-xs text-text-subtle">GET /api/v1/signal/{featured?.token ?? "…"}</span>
              </div>
              {sampleJson ? (
                <pre className="max-h-[24rem] overflow-x-auto overflow-y-auto p-5 font-mono text-[13px] leading-relaxed text-text-secondary">
                  {sampleJson}
                </pre>
              ) : (
                <div className="flex h-56 items-center justify-center text-xs text-text-subtle">
                  {featuredLoading ? "Fetching a live response…" : "Fetching live response…"}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center gap-4">
              <p className="text-[15px] leading-relaxed text-text-secondary">
                Compose autonomous workflows — pull a signal, interpret it, size a position, and log the
                decision. SignalForge gives your agent a dependable, explainable market layer.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="md" onClick={copyCurl}>
                  {copied ? "Copied!" : "Copy curl"}{" "}
                  <Keyboard className="h-4 w-4" />
                </Button>
                <a href="/playground">
                  <Button size="md" variant="secondary">Test in Agent API</Button>
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                <Badge tone="neutral">Binance Market Data</Badge>
                <Badge tone="neutral">FastAPI</Badge>
                <Badge tone="neutral">Next.js</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">
          {meta?.signal_count || "Five"} independent signals. One explainable market view.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-text-secondary">
          Watch the market with a signal you can trust and understand — from any device, or through any agent.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg">Launch SignalForge <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row sm:items-center">
          <span className="text-sm text-text-subtle">Built for the X-Agent AI MCP Hackathon 2026</span>
          <span className="text-xs text-text-subtle">
            Experimental market research — not financial advice
          </span>
        </div>
      </footer>
    </div>
  );
}