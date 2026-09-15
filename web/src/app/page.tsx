"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Activity,
  TrendingUp,
  BarChart3,
  Waves,
  Radio,
  ShieldCheck,
  Gauge,
  Ban,
  Braces,
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
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { EvidenceRail } from "@/components/atlas/EvidenceRail";
import { ActionabilityGate } from "@/components/atlas/ActionabilityGate";

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

function secondsAgo(date: Date | null): string {
  if (!date) return "awaiting first observation";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "observed now";
  if (seconds < 60) return `observed ${seconds}s ago`;
  return `observed ${Math.round(seconds / 60)}m ago`;
}

function providerLabel(provider?: string): string {
  if (provider === "multi_provider_public") return "MULTI-PROVIDER PUBLIC";
  if (provider === "binance_public") return "BINANCE PUBLIC";
  if (provider === "coinbase_exchange") return "COINBASE EXCHANGE";
  if (provider === "mock") return "MOCK — NON PRODUCTION";
  return "PROVENANCE PENDING";
}

export default function LandingPage() {
  const [overview, setOverview] = useState<SignalCard[]>([]);
  const [meta, setMeta] = useState<SignalsMetaResponse | null>(null);
  const [featured, setFeatured] = useState<SignalOk | null>(null);
  const [featuredToken, setFeaturedToken] = useState<string | null>(null);
  const [sampleJson, setSampleJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [, setNow] = useState(Date.now());
  const didLoad = useRef(false);

  useInterval(() => setNow(Date.now()), 1000);

  const pollTickers = useCallback(async () => {
    const next = await fetchTickers();
    if (next.length) setTickers(next);
  }, []);

  useEffect(() => {
    void pollTickers();
  }, [pollTickers]);
  useInterval(pollTickers, TICKER_POLL_MS);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const [metaRes, overviewRes] = await Promise.all([
          fetch("/api/v1/signals/meta"),
          fetch("/api/v1/overview"),
        ]);
        const nextMeta = await safeJson<SignalsMetaResponse>(metaRes, EMPTY_META);
        const nextOverview = await safeJson<MarketCards>(overviewRes, { market_cards: [] });
        if (cancelled) return;
        setMeta(nextMeta);
        setOverview(nextOverview.market_cards || []);
        setLastUpdated(new Date());
      } catch {
        if (!cancelled) setError("Live evidence field unavailable.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pollOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/overview");
      const nextOverview = await safeJson<MarketCards>(res, { market_cards: [] });
      if (nextOverview.market_cards?.length) {
        setOverview(nextOverview.market_cards);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch {
      // Preserve the last good evidence packet.
    }
  }, []);
  useInterval(pollOverview, POLL_MS);

  const loadFeatured = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/v1/signal/${token}`);
      const sig = await safeJson<SignalResponse>(res, UNPARSEABLE(token));
      if (isSignalOk(sig)) {
        setFeatured(sig);
        setSampleJson(buildSampleJson(sig));
        setLastUpdated(new Date());
        setError(null);
      }
    } catch {
      setError("Decision plate unavailable.");
    }
  }, []);

  useEffect(() => {
    if (featuredToken || !overview.length) return;
    const first = overview.find((row) => row.ok === true) as SignalOk | undefined;
    if (!first?.token) return;
    setFeaturedToken(first.token);
    void loadFeatured(first.token);
  }, [overview, featuredToken, loadFeatured]);

  useInterval(() => {
    if (featuredToken) void loadFeatured(featuredToken);
  }, featuredToken ? POLL_MS : null);

  const live = overview.filter((row): row is SignalOk => row.ok === true);
  const tickerByToken = new Map(tickers.map((ticker) => [ticker.token, ticker]));
  const observedProvider = featured?.source_meta?.provider || live.find((row) => row.source_meta?.provider)?.source_meta?.provider;
  const channels = meta?.signals?.length ? meta.signals : [
    { key: "technical", name: "Technical", weight: 0.25, description: "Price structure and momentum." },
    { key: "trend", name: "Trend", weight: 0.2, description: "Directional persistence." },
    { key: "volume", name: "Volume", weight: 0.15, description: "Participation and pressure." },
    { key: "open_interest", name: "Open Interest", weight: 0.2, description: "Futures positioning when available." },
    { key: "funding", name: "Funding", weight: 0.2, description: "Perpetual market bias when available." },
  ];

  return (
    <div className="atlas-shell min-h-screen bg-surface-app text-text">
      <nav className="sticky top-0 z-50 border-b border-border bg-surface-app/88 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden field-label md:inline-flex">evidence instrument / v0.3</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/judge" className="hidden sm:block"><Button variant="ghost" size="md">Judge dossier</Button></Link>
            <Link href="/dashboard"><Button size="md">Enter field <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background:repeating-radial-gradient(ellipse_at_78%_20%,transparent_0_42px,rgba(15,118,110,.12)_43px_44px,transparent_45px_67px)]" />
          <div className="relative mx-auto grid max-w-[1480px] gap-8 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-12 lg:items-end">
            <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="field-label">SEISMIC MARKET ATLAS / SIGNALFORGE</div>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.94] tracking-[-0.055em] text-text md:text-7xl">
                Map the evidence.<br />Refuse the fiction.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-text-secondary md:text-lg">
                A market decision layer that treats provenance, missing evidence and abstention as first-class system states — before an agent is allowed to trust a conclusion.
              </p>

              <div className="mt-9 grid max-w-xl grid-cols-3 gap-px border border-border bg-border">
                <div className="bg-surface/85 p-3"><p className="atlas-micro">provider</p><p className="mt-2 font-mono text-[11px] font-semibold text-text">{providerLabel(observedProvider)}</p></div>
                <div className="bg-surface/85 p-3"><p className="atlas-micro">policy</p><p className="mt-2 font-mono text-[11px] font-semibold text-text">FAIL CLOSED</p></div>
                <div className="bg-surface/85 p-3"><p className="atlas-micro">authority</p><p className="mt-2 font-mono text-[11px] font-semibold text-negative">NONE</p></div>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/dashboard"><Button size="lg">Inspect live field <ArrowRight className="h-4 w-4" /></Button></Link>
                <Link href="/judge"><Button size="lg" variant="secondary">Open proof surface</Button></Link>
              </div>
            </motion.div>

            <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
              <AtlasPanel label="Decision Plate" code="OBS-01" tone="live" meta={secondsAgo(lastUpdated)} className="trace-scan">
                <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
                  <div className="border-r-0 border-border xl:border-r xl:pr-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="atlas-micro">selected market</p>
                        <p className="mt-2 font-mono text-xl font-semibold text-text">{featured?.token || "BTC"}</p>
                        {featured && <PriceTicker price={tickerByToken.get(featured.token)?.price ?? featured.price} changePct={tickerByToken.get(featured.token)?.price_change_pct} className="mt-1 text-xs text-text-secondary" />}
                      </div>
                      {featured && <RecommendationBadge recommendation={featured.recommendation} />}
                    </div>
                    <div className="mt-10">
                      <p className="atlas-micro">composite score</p>
                      <p className="decision-score mt-3 font-mono text-[92px] font-semibold text-text">{featured ? featured.score.toFixed(0) : "—"}</p>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border">
                      <div className="bg-surface/70 p-3"><p className="atlas-micro">confidence</p><p className="mt-1 font-mono text-xl text-text">{featured ? `${Math.round(featured.confidence * 100)}%` : "—"}</p></div>
                      <div className="bg-surface/70 p-3"><p className="atlas-micro">coverage</p><p className="mt-1 font-mono text-xl text-text">{featured ? `${Math.round(featured.coverage * 100)}%` : "—"}</p></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <ActionabilityGate
                      actionability={featured?.actionability}
                      coverage={featured?.coverage}
                      confidence={featured?.confidence}
                      executionAuthorized={featured?.execution_authorized}
                    />
                    <EvidenceRail sources={featured?.source_meta?.sources} coverage={featured?.coverage} compact />
                  </div>
                </div>
                {error && <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-negative">FIELD ERROR / {error}</p>}
              </AtlasPanel>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="field-label">EVIDENCE STRATA</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-text md:text-5xl">Five channels.<br />Different epistemic weight.</h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-text-secondary">
                SignalForge never hides an unavailable channel behind a neutral-looking score. The interface exposes what entered the fusion and what was excluded.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="border-y border-border">
                {channels.map((channel, index) => {
                  const Icon = SIGNAL_ICONS[channel.key] || Activity;
                  const observed = featured?.sub_signals.find((signal) => signal.name === channel.key);
                  return (
                    <div key={channel.key} className="grid gap-3 border-b border-border py-4 last:border-b-0 md:grid-cols-[60px_1.1fr_0.7fr_0.45fr] md:items-center">
                      <span className="font-mono text-xs text-text-subtle">0{index + 1}</span>
                      <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-brand" /><div><p className="text-sm font-semibold text-text">{channel.name}</p><p className="mt-1 text-xs text-text-subtle">{channel.description}</p></div></div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-secondary">{observed?.available === false ? "EXCLUDED / NOT USED" : observed?.available ? `OBSERVED / ${observed.value.toFixed(1)}` : "WAITING FOR PACKET"}</div>
                      <div className="text-right font-mono text-xs text-text-subtle">weight {Math.round(channel.weight * 100)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface/45">
          <div className="mx-auto grid max-w-[1480px] gap-5 px-5 py-14 md:px-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AtlasPanel label="Failure Grammar" code="NEG-01" tone="critical" meta="REAL FAILURE > FAKE SUCCESS">
                <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
                  <div>
                    <Ban className="h-6 w-6 text-negative" />
                    <h3 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-text">Abstention is a product state, not an error screen.</h3>
                    <p className="mt-4 text-sm leading-6 text-text-secondary">
                      If coverage or confidence falls below the gate, SignalForge returns insufficient evidence and keeps execution authorization false. The UI shows the refusal instead of smoothing it away.
                    </p>
                  </div>
                  <ActionabilityGate actionability="insufficient_evidence" coverage={0.6} confidence={0.36} executionAuthorized={false} />
                </div>
              </AtlasPanel>
            </div>
            <div className="lg:col-span-5">
              <AtlasPanel label="Epistemic Legend" code="LEG-02" tone="quiet">
                <div className="space-y-0 border-y border-border">
                  {[
                    ["OBSERVED", "Returned by the live or controlled evidence surface."],
                    ["INFERRED", "Derived interpretation; never presented as raw observation."],
                    ["UNKNOWN", "Not measured or not safe to claim."],
                  ].map(([label, copy]) => (
                    <div key={label} className="grid grid-cols-[90px_1fr] gap-4 border-b border-border py-4 last:border-b-0">
                      <span className="font-mono text-[10px] font-semibold tracking-[0.13em] text-brand">{label}</span>
                      <span className="text-xs leading-5 text-text-secondary">{copy}</span>
                    </div>
                  ))}
                </div>
                <Link href="/judge" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-text hover:text-brand">See the judge proof dossier <ArrowRight className="h-4 w-4" /></Link>
              </AtlasPanel>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-4">
              <p className="field-label">AGENT INTERFACE</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-text">A packet an agent can inspect before trusting.</h2>
              <p className="mt-5 text-sm leading-6 text-text-secondary">
                The API exposes actionability, execution authority and source provenance beside the score. No hidden authority transfer.
              </p>
              <div className="mt-7 flex gap-3">
                <Link href="/playground"><Button>Open agent interface <Braces className="h-4 w-4" /></Button></Link>
                <Link href="/judge"><Button variant="secondary">Proof</Button></Link>
              </div>
            </div>
            <div className="lg:col-span-8">
              <AtlasPanel label="Decision Packet / JSON" code="API-04" tone="default" meta={featured?.token || "BTC"}>
                <pre className="max-h-[420px] overflow-auto border border-border bg-[#202b27] p-5 font-mono text-[11px] leading-6 text-[#dbe6e1]">
                  {sampleJson || "Awaiting a live evidence packet…"}
                </pre>
              </AtlasPanel>
            </div>
          </div>
        </section>

        <section className="border-t border-border px-5 py-14 md:px-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="atlas-kicker">SIGNALFORGE / X-AGENT 2026</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text">Evidence before recommendation. Refusal before false confidence.</h2>
            </div>
            <div className="flex gap-3"><Link href="/dashboard"><Button size="lg">Enter observation field</Button></Link><Link href="/judge"><Button size="lg" variant="secondary">Judge dossier</Button></Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}
