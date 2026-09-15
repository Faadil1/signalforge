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

const SIGNAL_ICONS: Record<string, LucideIcon> = {
  technical: Activity,
  trend: TrendingUp,
  funding: Radio,
  open_interest: BarChart3,
  volume: Waves,
};

const FALLBACK_ICON: LucideIcon = Activity;

function buildSampleJson(sig: SignalOk): string {
  return JSON.stringify(
    {
      token: sig.token,
      score: sig.score,
      confidence: sig.confidence,
      coverage: sig.coverage,
      actionability: sig.actionability,
      execution_authorized: sig.execution_authorized,
      source_meta: sig.source_meta,
      sub_signals: sig.sub_signals.map((s) => ({
        name: s.name,
        value: s.value,
        confidence: s.confidence,
        available: s.available,
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

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "Multi-provider public data";
  if (provider === "binance_public") return "Binance public data";
  if (provider === "coinbase_exchange") return "Coinbase Exchange";
  if (provider === "mock") return "Mock data";
  return "Explicit source provenance";
}

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
        if (!cancelled) setError("Live market evidence temporarily unavailable.");
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
      // Preserve the last good evidence snapshot on transient failure.
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
        setError(null);
      } else {
        setError("Deep-dive evidence unavailable.");
      }
    } catch {
      setError("Deep-dive evidence unavailable.");
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
    if (!firstOk?.token) return;
    setFeaturedToken(firstOk.token);
    loadFeatured(firstOk.token);
  }, [overview, featuredToken, loadFeatured]);

  const live = overview.filter((s): s is SignalOk => s.ok === true && !!s.token);
  const tickerByToken = new Map(tickers.map((t) => [t.token, t]));
  const observedProvider = featured?.source_meta?.provider || live.find((row) => row.source_meta?.provider)?.source_meta?.provider;

  const metaName = (key: string) => {
    const found = meta?.signals.find((s) => s.key === key);
    return found?.name || key.replace(/_/g, " ");
  };

  const copyCurl = async () => {
    const token = featured?.token ?? "BTC";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await navigator.clipboard.writeText(`curl "${origin}/api/v1/signal/${token}"`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <div className="min-h-screen bg-surface-app">
      <nav className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="hidden items-center gap-6 md:flex">
            <a href="#engine" className="text-sm font-medium text-text-secondary hover:text-text">Evidence Engine</a>
            <a href="#explain" className="text-sm font-medium text-text-secondary hover:text-text">Explainability</a>
            <a href="#agent" className="text-sm font-medium text-text-secondary hover:text-text">Agent API</a>
            <a href="https://github.com/Faadil1/signalforge" target="_blank" rel="noreferrer" className="text-sm font-medium text-text-secondary hover:text-text">View GitHub</a>
            <Link href="/dashboard"><Button size="md" className="ml-2">Launch App</Button></Link>
          </div>
          <Link href="/dashboard" className="md:hidden"><Button size="sm">Launch</Button></Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.08),transparent_30%),linear-gradient(to_bottom,transparent,rgba(15,23,42,0.025))]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Badge tone="brand" className="mb-5"><Zap className="h-3.5 w-3.5" /> X-Agent AI MCP Hackathon 2026</Badge>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-text md:text-6xl">
              Market intelligence
              <br />
              your agent can verify before acting.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">
              SignalForge combines up to five complementary evidence channels into one explainable market view.
              Unavailable, stale or untrusted evidence is excluded instead of silently increasing confidence.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/dashboard"><Button size="lg">Inspect live evidence <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/judge"><Button size="lg" variant="secondary">Open Judge Proof</Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-positive" /> Evidence-gated</span>
              <span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-positive" /> Explicit provenance</span>
              <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-positive" /> No execution authority</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="card overflow-hidden shadow-drawer">
            <div className="border-b border-border bg-surface-secondary/70 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-positive" />
                  <span className="font-mono text-xs text-positive">LIVE EVIDENCE</span>
                  <span className="text-xs text-text-subtle">updated {secondsAgo(lastUpdated) ?? "…"}</span>
                </div>
                <Badge tone="neutral">{providerLabel(observedProvider)}</Badge>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {live.length ? live.slice(0, 4).map((row) => (
                <div key={row.token} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border border-border bg-surface p-4">
                  <div>
                    <p className="font-mono text-sm font-semibold text-text">{row.token}</p>
                    <PriceTicker price={tickerByToken.get(row.token)?.price ?? row.price} changePct={tickerByToken.get(row.token)?.price_change_pct} className="text-xs text-text-subtle" />
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-text-subtle">{Math.round(row.coverage * 100)}% evidence coverage</p>
                  </div>
                  <RecommendationBadge recommendation={row.recommendation ?? ""} />
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold tabular-nums text-text">{row.score.toFixed(1)}</p>
                    <p className="text-[11px] text-text-subtle">Composite</p>
                  </div>
                </div>
              )) : (
                <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full rounded-lg" />)}</div>
              )}
              {error && <p className="text-xs text-negative">{error}</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border px-6 py-4 text-xs text-text-subtle">
              <span>Up to {meta?.signal_count || 5} complementary evidence channels</span>
              <Link href="/dashboard" className="flex items-center gap-1 font-medium text-brand hover:text-brand-hover">Open dashboard <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="engine" className="bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Evidence Fusion</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">Five complementary channels. One bounded conclusion.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-text-secondary">
              Available evidence is normalized and weighted; unavailable evidence remains visible but excluded from fusion.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(meta?.signals || []).map((s) => {
              const Icon = SIGNAL_ICONS[s.key] || FALLBACK_ICON;
              return (
                <div key={s.key} className="card p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-brand" />
                    <span className="font-mono text-xs text-text-subtle">{Math.round(s.weight * 100)}%</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-text">{s.name}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">{s.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="explain" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Explainability</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">The missing evidence is part of the answer.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
              SignalForge exposes coverage, source provenance, confidence and the exact channels that were excluded. A score never hides the evidence state behind it.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-text-secondary">
              {["Per-source provenance", "Freshness and availability gates", "Coverage-aware confidence", "Execution authority always false"].map((item) => (
                <li key={item} className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-positive" /> {item}</li>
              ))}
            </ul>
          </div>

          <div className="card p-6 shadow-drawer">
            {featured ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-text">{featured.token}</p>
                    <p className="text-xs text-text-subtle">{featured.available_signals}/{featured.total_signals} usable · coverage {(featured.coverage * 100).toFixed(0)}%</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{providerLabel(featured.source_meta?.provider)}</Badge>
                    <RecommendationBadge recommendation={featured.recommendation} />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="font-mono text-5xl font-bold tabular-nums text-text">{featured.score.toFixed(0)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-text-subtle">Composite · conf {(featured.confidence * 100).toFixed(0)}% · {featured.actionability.replace("_", " ")}</p>
                </div>
                <div className="mt-5 space-y-3">
                  {featured.sub_signals.map((s) => (
                    <div key={s.name} className={s.available ? "" : "rounded-md border border-dashed border-border bg-surface-secondary/40 p-2"}>
                      <div className="flex items-center gap-3">
                        <span className="w-28 truncate text-xs text-text-secondary">{metaName(s.name)}</span>
                        {s.available ? (
                          <>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary"><div className={`h-full rounded-full ${barTone(s.value)}`} style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }} /></div>
                            <span className="w-8 text-right font-mono text-xs text-text-secondary">{s.value.toFixed(0)}</span>
                          </>
                        ) : (
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-subtle">excluded · unavailable</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-border pt-4">
                  {Object.entries(featured.source_meta?.sources || {}).map(([name, source]) => (
                    <Badge key={name} tone={source === "unavailable" ? "neutral" : "brand"}>{name.replace("open_interest", "OI")}: {source}</Badge>
                  ))}
                </div>
              </>
            ) : featuredLoading ? (
              <div className="space-y-4"><div className="skeleton h-4 w-24" /><div className="skeleton mx-auto h-16 w-20" /><div className="skeleton h-32 w-full" /></div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-text-subtle">Waiting for a verified evidence packet…</div>
            )}
          </div>
        </div>
      </section>

      <section id="agent" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">Agent-native</p>
            <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">Structured for agents. Bounded by evidence.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-text-secondary">
              Typed JSON exposes the score, evidence coverage, provenance and refusal state so agents can inspect and reason over the packet without gaining execution authority.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-negative/40" /><span className="h-3 w-3 rounded-full bg-warning/40" /><span className="h-3 w-3 rounded-full bg-positive/40" />
                <span className="ml-2 font-mono text-xs text-text-subtle">GET /api/v1/signal/{featured?.token ?? "BTC"}</span>
              </div>
              {sampleJson ? <pre className="max-h-[25rem] overflow-auto p-5 font-mono text-[12px] leading-relaxed text-text-secondary">{sampleJson}</pre> : <div className="flex h-56 items-center justify-center text-xs text-text-subtle">Fetching live response…</div>}
            </div>

            <div className="flex flex-col justify-center gap-5">
              <div className="card border-brand/20 bg-brand/[0.025] p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">Authority boundary</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">SignalForge can explain and recommend. It cannot authorize funds to move. Every live packet keeps <span className="font-mono text-text">execution_authorized: false</span>.</p>
              </div>
              <p className="text-[15px] leading-relaxed text-text-secondary">Compose research workflows — inspect evidence, compare state, record a decision and abstain when coverage degrades.</p>
              <div className="flex flex-wrap gap-3">
                <Button size="md" onClick={copyCurl}>{copied ? "Copied!" : "Copy curl"} <Keyboard className="h-4 w-4" /></Button>
                <Link href="/playground"><Button size="md" variant="secondary">Test in Agent API</Button></Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                <Badge tone="neutral">Multi-provider Public Data</Badge><Badge tone="neutral">FastAPI</Badge><Badge tone="neutral">Next.js</Badge><Badge tone="neutral">Cloudflare Worker</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-text md:text-4xl">Five complementary evidence channels. One explainable market view.</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-text-secondary">Know what is observed, what is missing, and when the correct answer is to abstain.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3"><Link href="/dashboard"><Button size="lg">Inspect SignalForge <ArrowRight className="h-4 w-4" /></Button></Link><Link href="/judge"><Button size="lg" variant="secondary">Verify the proof</Button></Link></div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="text-sm text-text-subtle">Built for the X-Agent AI MCP Hackathon 2026</span>
          <span className="text-xs text-text-subtle">Research signals only · no execution authority · not financial advice</span>
        </div>
      </footer>
    </div>
  );
}
