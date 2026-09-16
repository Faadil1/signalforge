"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Play, ArrowLeftRight, FlaskConical, AlertTriangle, ShieldOff } from "lucide-react";
import { safeJson } from "@/lib/api";
import { ENABLE_BACKTESTS } from "@/lib/features";
import { Button } from "@/components/ui/Button";

type StrategyMeta = { id: string; name: string; description: string };
type Backtest = {
  ok: true;
  strategy: string;
  token: string;
  period: string;
  actual_period: string;
  config: { fee_bps: number; slippage_bps: number };
  disclaimer: string;
  experimental: boolean;
  metrics: {
    total_return: string;
    sharpe_ratio: number;
    max_drawdown: string;
    win_rate: string;
    total_trades: number;
    avg_trade_duration: string;
  };
  equity_curve: { date: string; value: number }[];
  trades: {
    id: number;
    token: string;
    entry_date: string;
    exit_date: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
  }[];
};

const SYSTEM_STRATEGY_ID = "momentum";
const CHART_COLORS = ["#3257FF", "#E73DFF", "#FF8A1F"];

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [backtests, setBacktests] = useState<Record<string, Backtest>>({});
  const [active, setActive] = useState<string>(SYSTEM_STRATEGY_ID);
  const [token, setToken] = useState("BTC");
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextToken: string) => {
    if (!ENABLE_BACKTESTS) return;
    setLoading(true);
    setError(null);
    try {
      const strategyRes = await fetch("/api/v1/strategies");
      if (!strategyRes.ok) throw new Error("Calibration strategies unavailable");
      const strategyData = await safeJson<{ strategies: StrategyMeta[] }>(strategyRes, { strategies: [] });
      setStrategies(strategyData.strategies || []);

      const results: Record<string, Backtest> = {};
      for (const strategy of strategyData.strategies || []) {
        const res = await fetch(`/api/v1/strategy/${strategy.id}/backtest?token=${nextToken}&period=90d`);
        if (!res.ok) continue;
        const result = await safeJson<Backtest>(res, {
          ok: true,
          strategy: strategy.id,
          token: nextToken,
          period: "90d",
          actual_period: "",
          config: { fee_bps: 0, slippage_bps: 0 },
          disclaimer: "",
          experimental: true,
          metrics: { total_return: "0%", sharpe_ratio: 0, max_drawdown: "0%", win_rate: "0%", total_trades: 0, avg_trade_duration: "—" },
          equity_curve: [],
          trades: [],
        });
        if (result.ok) results[strategy.id] = result;
      }
      setBacktests(results);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Calibration failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("BTC"); }, [load]);

  if (!ENABLE_BACKTESTS) {
    return (
      <div className="space-y-7">
        <header className="border-b border-border/70 pb-6"><p className="forge-eyebrow">06 / CALIBRATION LAB</p><h1 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">Calibration disabled.</h1></header>
        <div className="forge-panel border-prism-orange/40 p-6"><p className="text-sm leading-6 text-text-secondary">Backtests are disabled in this deployment. The lab is experimental and is not required for the verified decision runtime.</p></div>
      </div>
    );
  }

  const backtest = backtests[active];
  const meta = strategies.find((strategy) => strategy.id === active);
  const metrics = backtest ? [
    ["total return", backtest.metrics.total_return, "#3257FF"],
    ["sharpe", backtest.metrics.sharpe_ratio.toFixed(2), "#00C9E8"],
    ["drawdown", backtest.metrics.max_drawdown, "#FF4F73"],
    ["win rate", backtest.metrics.win_rate, "#C6F432"],
    ["trades", String(backtest.metrics.total_trades), "#6E46FF"],
    ["avg duration", backtest.metrics.avg_trade_duration, "#FF8A1F"],
  ] : [];

  return (
    <div className="space-y-7">
      <header className="grid gap-6 border-b border-border/70 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="forge-eyebrow">06 / CALIBRATION LAB</p>
          <h1 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">Stress the rule.<br />Never sell the story.</h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">Experimental deterministic simulations on observed public kline history. Calibration is secondary evidence and cannot become a profitability claim.</p>
        </div>
        <div className="flex flex-wrap gap-2"><input className="input w-24 font-mono" value={token} maxLength={10} onChange={(event) => setToken(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void load(token)} /><Button variant="secondary" onClick={() => void load(token)} loading={loading}>{!loading && <Play className="h-4 w-4" />} Run</Button><Button variant={showCompare ? "primary" : "secondary"} onClick={() => setShowCompare((value) => !value)}><ArrowLeftRight className="h-4 w-4" /> Compare</Button></div>
      </header>

      <div className="grid gap-4 border border-prism-orange/35 bg-prism-orange/[0.08] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
        <AlertTriangle className="h-5 w-5 text-prism-orange" />
        <p className="text-xs leading-5 text-text-secondary"><span className="font-semibold text-prism-orange">Experimental calibration.</span> Fees and slippage are explicit assumptions. Historical simulation never upgrades research output into execution authority.</p>
        <span className="flex items-center gap-2 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-prism-coral"><ShieldOff className="h-4 w-4" /> authority / none</span>
      </div>
      {error && <div className="border border-prism-coral/40 bg-prism-coral/10 px-4 py-3 font-mono text-[10px] text-prism-coral">LAB ERROR / {error}</div>}

      <section className="grid gap-6 xl:grid-cols-[.28fr_.72fr]">
        <div className="forge-panel overflow-hidden">
          <div className="border-b border-border/70 bg-white/60 px-5 py-4"><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-prism-lime" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-text">RULE INDEX</span></div><p className="mt-2 text-xs text-text-secondary">{strategies.length} deterministic experimental rules.</p></div>
          <div className="divide-y divide-border/70">
            {strategies.map((strategy, index) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return <button key={strategy.id} type="button" onClick={() => setActive(strategy.id)} className={clsx("relative w-full px-5 py-5 text-left transition-[background-color,transform]", active === strategy.id ? "bg-white" : "bg-white/30 hover:bg-white/70")}><span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color, opacity: active === strategy.id ? 1 : .35 }} /><div className="flex items-center justify-between"><span className="font-mono text-[8px] font-semibold tracking-[0.15em]" style={{ color }}>R-0{index + 1}</span>{active === strategy.id && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}</div><p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-text">{strategy.name}</p><p className="mt-2 text-[11px] leading-5 text-text-subtle">{strategy.description}</p></button>;
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
            {metrics.length ? metrics.map(([metricLabel, value, color]) => <div key={metricLabel} className="relative bg-white/82 p-4"><span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} /><p className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-subtle">{metricLabel}</p><p className={clsx("mt-2 font-mono text-xl font-semibold", metricLabel === "total return" && String(value).startsWith("-") ? "text-prism-coral" : "text-text")}>{value}</p></div>) : [0,1,2,3,4,5].map((index) => <div key={index} className="bg-white/80 p-4"><p className="atlas-micro">loading</p><p className="mt-2 font-mono text-xl text-text-subtle">—</p></div>)}
          </div>

          <div className="forge-panel p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="forge-eyebrow">EQUITY TRACE</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">Calibration curve, not a promise.</h2></div><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">{backtest ? `${backtest.token} / ${backtest.actual_period}` : "waiting"}</span></div>
            <div className="mt-6 h-[320px]">
              {backtest ? <ResponsiveContainer width="100%" height="100%"><LineChart><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#77758E" }} tickLine={false} axisLine={{ stroke: "#B9C6F2" }} /><YAxis tick={{ fontSize: 9, fill: "#77758E" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(value) => value.toLocaleString()} width={64} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #B9C6F2", borderRadius: 8, fontSize: 11, color: "#171522" }} /><Legend wrapperStyle={{ fontSize: 10 }} />{showCompare ? strategies.map((strategy, index) => { const result = backtests[strategy.id]; return result ? <Line key={strategy.id} data={result.equity_curve} type="monotone" dataKey="value" name={strategy.name} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={1.8} dot={false} /> : null; }) : <Line data={backtest.equity_curve} type="monotone" dataKey="value" name={meta?.name || active} stroke="#3257FF" strokeWidth={2.4} dot={false} />}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center"><FlaskConical className="h-8 w-8 animate-evidence-pulse text-text-subtle" /></div>}
            </div>
          </div>
        </div>
      </section>

      {backtest && (
        <section className="forge-panel overflow-hidden">
          <div className="flex items-end justify-between gap-4 border-b border-border/70 px-5 py-4 md:px-6"><div><p className="forge-eyebrow">TRADE LEDGER</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">Execution dates stay explicit.</h2></div><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">{backtest.trades.length} trades</span></div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px] grid-cols-[50px_80px_120px_120px_100px_1fr] gap-3 border-b border-border/70 bg-prism-violet/[0.04] px-5 py-3 font-mono text-[8px] uppercase tracking-[0.14em] text-text-subtle md:px-6"><span>#</span><span>token</span><span>entry</span><span>exit</span><span>pnl</span><span>price path</span></div>
            {backtest.trades.map((trade) => <div key={trade.id} className="grid min-w-[760px] grid-cols-[50px_80px_120px_120px_100px_1fr] gap-3 border-b border-border/70 px-5 py-3 text-xs last:border-b-0 md:px-6"><span className="font-mono text-text-subtle">{trade.id}</span><span className="font-mono font-semibold text-text">{trade.token}</span><span className="font-mono text-text-secondary">{trade.entry_date}</span><span className="font-mono text-text-secondary">{trade.exit_date}</span><span className={clsx("font-mono font-semibold", trade.pnl_pct >= 0 ? "text-positive" : "text-prism-coral")}>{trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct}%</span><span className="font-mono text-text-secondary">${trade.entry_price.toLocaleString()} → ${trade.exit_price.toLocaleString()}</span></div>)}
            {!backtest.trades.length && <div className="py-9 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">NO TRADES TRIGGERED IN THIS WINDOW</div>}
          </div>
        </section>
      )}
    </div>
  );
}
