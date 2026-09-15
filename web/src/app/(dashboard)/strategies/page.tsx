"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Play, ArrowLeftRight, FlaskConical, AlertTriangle } from "lucide-react";
import { safeJson } from "@/lib/api";
import { ENABLE_BACKTESTS } from "@/lib/features";
import { Button } from "@/components/ui/Button";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";

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
const CHART_COLORS = ["#0F766E", "#A44E2B", "#D1A633"];

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

  useEffect(() => {
    void load("BTC");
  }, [load]);

  if (!ENABLE_BACKTESTS) {
    return (
      <div className="space-y-5">
        <header className="border-b border-border pb-5"><p className="field-label">03 / CALIBRATION LAB</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-text">Calibration disabled.</h1></header>
        <AtlasPanel label="Feature Gate" code="LAB-00" tone="warning"><p className="text-sm leading-6 text-text-secondary">Backtests are disabled in this deployment. The lab is experimental and is not required for the verified decision runtime.</p></AtlasPanel>
      </div>
    );
  }

  const backtest = backtests[active];
  const meta = strategies.find((strategy) => strategy.id === active);
  const metrics = backtest ? [
    ["total return", backtest.metrics.total_return],
    ["sharpe", backtest.metrics.sharpe_ratio.toFixed(2)],
    ["drawdown", backtest.metrics.max_drawdown],
    ["win rate", backtest.metrics.win_rate],
    ["trades", String(backtest.metrics.total_trades)],
    ["avg duration", backtest.metrics.avg_trade_duration],
  ] : [];

  return (
    <div className="space-y-5">
      <header className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="field-label">03 / CALIBRATION LAB</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-text md:text-5xl">Test the rule, not the story.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Experimental deterministic simulations on observed public kline history. This is calibration evidence, not proof of profitability.</p></div>
        <div className="flex flex-wrap gap-2"><input className="input w-24 font-mono" value={token} maxLength={10} onChange={(event) => setToken(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void load(token)} /><Button variant="secondary" onClick={() => void load(token)} loading={loading}>{!loading && <Play className="h-4 w-4" />} Run</Button><Button variant={showCompare ? "primary" : "secondary"} onClick={() => setShowCompare((value) => !value)}><ArrowLeftRight className="h-4 w-4" /> Compare</Button></div>
      </header>

      <div className="flex items-start gap-3 border border-warning/40 bg-warning/5 px-4 py-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-xs leading-5 text-text-secondary"><span className="font-semibold text-warning">Experimental calibration.</span> Fees and slippage are explicit assumptions; past performance is not a future-performance claim.</p></div>
      {error && <div className="border border-negative/40 bg-negative/5 px-4 py-3 font-mono text-[11px] text-negative">LAB ERROR / {error}</div>}

      <div className="grid gap-5 xl:grid-cols-12">
        <AtlasPanel label="Strategy Index" code="LAB-A" meta={`${strategies.length} rules`} className="xl:col-span-3">
          <div className="border-y border-border">
            {strategies.map((strategy, index) => <button key={strategy.id} type="button" onClick={() => setActive(strategy.id)} className={clsx("w-full border-b border-border px-2 py-4 text-left last:border-b-0", active === strategy.id ? "bg-brand/[0.055]" : "hover:bg-surface-secondary/45")}><div className="flex items-center justify-between"><span className="font-mono text-[9px] text-text-subtle">R-0{index + 1}</span>{active === strategy.id && <span className="evidence-dot evidence-dot-live" />}</div><p className="mt-2 text-sm font-semibold text-text">{strategy.name}</p><p className="mt-1 text-[11px] leading-5 text-text-subtle">{strategy.description}</p></button>)}
          </div>
        </AtlasPanel>

        <div className="space-y-5 xl:col-span-9">
          <div className="survey-strip">
            {metrics.length ? metrics.map(([label, value]) => <div key={label} className="survey-cell col-span-6 sm:col-span-4 lg:col-span-2"><p className="atlas-micro">{label}</p><p className={clsx("mt-1 font-mono text-lg font-semibold", label === "total return" && String(value).startsWith("-") ? "text-negative" : "text-text")}>{value}</p></div>) : [0,1,2,3,4,5].map((index) => <div key={index} className="survey-cell col-span-6 sm:col-span-4 lg:col-span-2"><p className="atlas-micro">loading</p><p className="mt-1 font-mono text-lg text-text-subtle">—</p></div>)}
          </div>

          <AtlasPanel label="Equity Trace" code="LAB-B" tone="quiet" meta={backtest ? `${backtest.token} / ${backtest.actual_period}` : "WAITING"}>
            {backtest ? <ResponsiveContainer width="100%" height={310}><LineChart><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={{ stroke: "#B9C5BF" }} /><YAxis tick={{ fontSize: 9, fill: "#7B8782" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(value) => value.toLocaleString()} width={64} /><Tooltip contentStyle={{ background: "#EAF0ED", border: "1px solid #B9C5BF", borderRadius: 2, fontSize: 11, color: "#1B2421" }} /><Legend wrapperStyle={{ fontSize: 10 }} />{showCompare ? strategies.map((strategy, index) => { const result = backtests[strategy.id]; return result ? <Line key={strategy.id} data={result.equity_curve} type="monotone" dataKey="value" name={strategy.name} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={1.5} dot={false} /> : null; }) : <Line data={backtest.equity_curve} type="monotone" dataKey="value" name={meta?.name || active} stroke="#0F766E" strokeWidth={2} dot={false} />}</LineChart></ResponsiveContainer> : <div className="flex h-[310px] items-center justify-center"><FlaskConical className="h-7 w-7 animate-evidence-pulse text-text-subtle" /></div>}
          </AtlasPanel>
        </div>
      </div>

      {backtest && (
        <AtlasPanel label="Trade Ledger" code="LAB-C" meta={`${backtest.trades.length} trades`}>
          <div className="overflow-x-auto border-y border-border">
            <div className="grid min-w-[760px] grid-cols-[50px_80px_120px_120px_100px_1fr] gap-3 border-b border-border py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle"><span>#</span><span>token</span><span>entry</span><span>exit</span><span>pnl</span><span>price path</span></div>
            {backtest.trades.map((trade) => <div key={trade.id} className="grid min-w-[760px] grid-cols-[50px_80px_120px_120px_100px_1fr] gap-3 border-b border-border py-3 text-xs last:border-b-0"><span className="font-mono text-text-subtle">{trade.id}</span><span className="font-mono font-semibold text-text">{trade.token}</span><span className="font-mono text-text-secondary">{trade.entry_date}</span><span className="font-mono text-text-secondary">{trade.exit_date}</span><span className={clsx("font-mono font-semibold", trade.pnl_pct >= 0 ? "text-positive" : "text-negative")}>{trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct}%</span><span className="font-mono text-text-secondary">${trade.entry_price.toLocaleString()} → ${trade.exit_price.toLocaleString()}</span></div>)}
            {!backtest.trades.length && <div className="py-8 text-center font-mono text-[10px] text-text-subtle">NO TRADES TRIGGERED IN THIS WINDOW</div>}
          </div>
        </AtlasPanel>
      )}
    </div>
  );
}
