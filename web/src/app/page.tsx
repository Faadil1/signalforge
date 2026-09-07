"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { isSignalOk, type SignalResponse } from "@/lib/api";
import { ENABLE_BACKTESTS } from "@/lib/features";

const SIGNALS = [
  { name: "Technical", weight: "25%", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { name: "Trend", weight: "25%", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { name: "Funding", weight: "20%", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l2-2 1.5 1.5L12 19l2.5 2.5L16 21a2 2 0 002-2z" },
  { name: "Open Interest", weight: "15%", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: "Volume", weight: "15%", icon: "M15 12h3a1 1 0 011 1v6a1 1 0 01-1 1h-3a1 1 0 01-1-1v-6a1 1 0 011-1zM6 8h3a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V9a1 1 0 011-1zm9-4h3a1 1 0 011 1v16a1 1 0 01-1 1h-3a1 1 0 01-1-1V5a1 1 0 011-1z" },
];

const REC_BADGE: Record<string, string> = {
  strong_buy: "bg-sf-accent/15 text-sf-accent",
  buy: "bg-green-500/15 text-green-400",
  hold: "bg-sf-muted/15 text-sf-muted",
  sell: "bg-orange-500/15 text-orange-400",
  strong_sell: "bg-sf-danger/15 text-sf-danger",
};

const FEATURES = [
  { title: "Composite Signal Score", desc: "5 independent real-time market signals fused into one 0-100 score with weighted confidence. No noise, just signal." },
  { title: "Honest Backtests", desc: "Momentum, Mean-Reversion, Sentiment-Flow — deterministic rule backtests on real klines with fees and slippage. Experimental, not financial advice." },
  { title: "Token Deep Dive", desc: "Drill into any token. See the score breakdown, price & volume charts, funding, and open interest drivers." },
  { title: "Webhook Alerts", desc: "Set thresholds on the composite score and get webhook notifications when conditions hit. Disabled by default." },
  { title: "API Playground", desc: "Interactive API tester. Try every live endpoint, see real responses, monitor real usage." },
  { title: "Real Market Data", desc: "All signals compute from live Binance klines, open interest, funding, and volume — nothing is mocked." },
];

export default function LandingPage() {
  const [live, setLive] = useState<{ token: string; price: number; score: number; recommendation: string } | null>(null);
  const [strategies, setStrategies] = useState<{ name: string; desc: string; sharpe: string; ret: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sigRes = await fetch("/api/v1/signal/BTC");
        const s = (await sigRes.json()) as SignalResponse;
        if (!cancelled && isSignalOk(s)) {
          setLive({ token: s.token, price: s.price, score: s.score, recommendation: s.recommendation });
        } else if (!cancelled) {
          setError("Live BTC signal temporarily unavailable. Retry in a moment.");
        }
      } catch {
        if (!cancelled) setError("Live BTC signal temporarily unavailable. Retry in a moment.");
      }

      if (ENABLE_BACKTESTS) {
        try {
          const listRes = await fetch("/api/v1/strategies");
          const stratList = await listRes.json();
          const results: { name: string; desc: string; sharpe: string; ret: string }[] = [];
          for (const m of stratList.strategies || []) {
            const btRes = await fetch(`/api/v1/strategy/${m.id}/backtest?token=BTC&period=90d`);
            if (btRes.ok) {
              const bt = await btRes.json();
              if (bt.ok) {
                results.push({
                  name: m.name,
                  desc: m.description,
                  sharpe: bt.metrics.sharpe_ratio.toFixed(2),
                  ret: bt.metrics.total_return,
                });
              }
            }
          }
          if (!cancelled) setStrategies(results);
        } catch {
          // Strategies preview is non-critical; the landing page stays usable.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-sf-bg">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-sf-bg/80 backdrop-blur-md border-b border-sf-border z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-sf-accent rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-sf-bg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">SignalForge</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#features" className="text-xs text-sf-muted hover:text-sf-text transition-colors">Features</Link>
            <Link href="#signals" className="text-xs text-sf-muted hover:text-sf-text transition-colors">Signals</Link>
            <Link href="#strategies" className="text-xs text-sf-muted hover:text-sf-text transition-colors">Strategies</Link>
            <Link href="/dashboard" className="bg-sf-accent text-sf-bg text-xs font-medium px-3 py-1.5 rounded hover:bg-sf-accent/90 transition-colors">
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-sf-card border border-sf-border rounded px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 bg-sf-accent rounded-full animate-pulse" />
            <span className="text-[11px] text-sf-muted">X-Agent AI MCP Hackathon 2026</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            5 signals. 1 score.
            <br />
            <span className="text-sf-accent">Zero noise.</span>
          </h1>

          <p className="text-base text-sf-muted max-w-xl mx-auto mb-8 leading-relaxed">
            SignalForge fuses technical indicators, trend structure, funding, open interest, and volume into a single Composite Signal Score — computed live from Binance market data. No noise, just signal.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard" className="bg-sf-accent text-sf-bg text-sm font-medium px-5 py-2.5 rounded hover:bg-sf-accent/90 transition-colors">
              Open Dashboard
            </Link>
            <a href="#signals" className="bg-sf-card text-sf-text text-sm font-medium px-5 py-2.5 rounded border border-sf-border hover:border-sf-accent transition-colors">
              See How It Works
            </a>
          </div>

          {/* Live score preview */}
          <div className="mt-16 card p-4 max-w-2xl mx-auto">
            <div className="grid grid-cols-5 gap-3">
              {SIGNALS.map((s) => (
                <div key={s.name} className="text-center">
                  <div className="w-10 h-10 mx-auto bg-sf-bg border border-sf-border rounded flex items-center justify-center mb-1.5">
                    <svg className="w-5 h-5 text-sf-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                  </div>
                  <p className="text-[10px] text-sf-muted">{s.name}</p>
                  <p className="text-xs font-mono text-sf-accent">{s.weight}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-sf-border flex items-center justify-center gap-4">
              {live ? (
                <>
                  <span className="text-[10px] text-sf-muted uppercase tracking-wider">Live {live.token}</span>
                  <span className={clsx("text-2xl font-bold font-mono", live.score >= 75 ? "text-sf-accent" : live.score >= 60 ? "text-green-400" : live.score >= 40 ? "text-sf-muted" : "text-sf-danger")}>
                    {live.score.toFixed(1)}
                  </span>
                  <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", REC_BADGE[live.recommendation])}>
                    {live.recommendation.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-mono text-sf-muted">${live.price.toLocaleString()}</span>
                </>
              ) : error ? (
                <span className="text-[10px] font-mono text-sf-danger">live preview unavailable</span>
              ) : (
                <span className="text-[10px] font-mono text-sf-muted animate-pulse">loading live score…</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Signals */}
      <section id="signals" className="py-20 px-6 border-t border-sf-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-sf-accent uppercase tracking-widest mb-2">Signal Fusion</p>
            <h2 className="text-2xl font-bold tracking-tight">Every signal. One number.</h2>
            <p className="text-sm text-sf-muted mt-2 max-w-lg mx-auto">
              5 live Binance market signals, each normalized to 0-100, weighted by reliability, fused into a single actionable score.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SIGNALS.map((s) => (
              <div key={s.name} className="card p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-sf-bg border border-sf-border rounded flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-sf-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium">{s.name}</h3>
                    <span className="text-[10px] font-mono text-sf-accent">{s.weight}</span>
                  </div>
                  <p className="text-xs text-sf-muted">Computed from real futures klines, funding rate, and open interest.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-sf-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-sf-accent uppercase tracking-widest mb-2">Features</p>
            <h2 className="text-2xl font-bold tracking-tight">Built for conviction</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-4">
                <h3 className="text-sm font-medium mb-1">{f.title}</h3>
                <p className="text-xs text-sf-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategies */}
      <section id="strategies" className="py-20 px-6 border-t border-sf-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] text-sf-accent uppercase tracking-widest mb-2">Pre-Built Strategies</p>
            <h2 className="text-2xl font-bold tracking-tight">Deterministic backtests on real data.</h2>
            <p className="text-sm text-sf-muted mt-2">Rule-based simulations on historical Binance klines. Experimental — not financial advice.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {!ENABLE_BACKTESTS ? (
              <div className="card p-4 text-xs text-sf-muted col-span-3 text-center">
                <p className="text-sf-accent font-medium">Experimental — disabled by default</p>
                <p className="mt-1">
                  Strategy backtests run on historical klines with assumed fees and slippage. They are not financial
                  advice. Enable <span className="font-mono">ENABLE_BACKTESTS</span> to preview them.
                </p>
              </div>
            ) : strategies
              ? strategies.map((s) => (
                  <div key={s.name} className="card p-4">
                    <h3 className="text-sm font-medium mb-1">{s.name}</h3>
                    <p className="text-xs text-sf-muted mb-3">{s.desc}</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-sf-muted uppercase">Sharpe</p>
                        <p className="text-lg font-mono font-semibold">{s.sharpe}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-sf-muted uppercase">Return</p>
                        <p className="text-lg font-mono font-semibold text-sf-accent">{s.ret}</p>
                      </div>
                    </div>
                  </div>
                ))
              : (
                  <div className="card p-4 text-xs text-sf-muted col-span-3 text-center animate-pulse">
                    running live backtests…
                  </div>
                )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-sf-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Start trading with signal, not noise.</h2>
          <Link href="/dashboard" className="inline-block bg-sf-accent text-sf-bg text-sm font-medium px-6 py-2.5 rounded hover:bg-sf-accent/90 transition-colors">
            Open SignalForge
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sf-border py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px] text-sf-muted">
          <span>SignalForge — X-Agent AI MCP Hackathon 2026</span>
          <span>Live Binance market data</span>
        </div>
      </footer>
    </div>
  );
}