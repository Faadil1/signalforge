"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import { ENABLE_BACKTESTS } from "@/lib/features";

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

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [backtests, setBacktests] = useState<Record<string, Backtest>>({});
  const [active, setActive] = useState<string>(SYSTEM_STRATEGY_ID);
  const [token, setToken] = useState("BTC");
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    if (!ENABLE_BACKTESTS) return;
    setLoading(true);
    setError(null);
    try {
      const stratRes = await fetch("/api/v1/strategies");
      if (!stratRes.ok) throw new Error("Failed to load strategies");
      const stratData = await stratRes.json();
      setStrategies(stratData.strategies || []);

      const results: Record<string, Backtest> = {};
      for (const s of stratData.strategies || []) {
        const res = await fetch(`/api/v1/strategy/${s.id}/backtest?token=${t}&period=90d`);
        if (res.ok) {
          const bt = await res.json();
          if (bt.ok) results[s.id] = bt as Backtest;
        }
      }
      setBacktests(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load backtests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("BTC");
  }, [load]);

  if (!ENABLE_BACKTESTS) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Strategy Backtester</h1>
          <p className="text-sm text-sf-muted">Deterministic backtests on real Binance klines</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-sm text-sf-accent font-medium mb-2">Experimental feature — disabled</p>
          <p className="text-xs text-sf-muted">
            Backtests are disabled in this deployment. Enable them by setting{" "}
            <span className="font-mono text-sf-text">ENABLE_BACKTESTS=true</span> on the API and{" "}
            <span className="font-mono text-sf-text">NEXT_PUBLIC_ENABLE_BACKTESTS=true</span> on the web build.
          </p>
        </div>
      </div>
    );
  }

  const bt = backtests[active];
  const meta = strategies.find((s) => s.id === active);

  const metricsRows = bt
    ? [
        { label: "Total Return", value: bt.metrics.total_return, color: bt.metrics.total_return.startsWith("+") ? "text-sf-accent" : "text-sf-danger" },
        { label: "Sharpe Ratio", value: bt.metrics.sharpe_ratio.toFixed(2), color: "text-sf-text" },
        { label: "Max Drawdown", value: bt.metrics.max_drawdown, color: "text-sf-danger" },
        { label: "Win Rate", value: bt.metrics.win_rate, color: "text-sf-text" },
        { label: "Total Trades", value: String(bt.metrics.total_trades), color: "text-sf-text" },
        { label: "Avg Duration", value: bt.metrics.avg_trade_duration, color: "text-sf-muted" },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Strategy Backtester</h1>
          <p className="text-sm text-sf-muted">Deterministic backtests on real Binance klines</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={token}
            maxLength={10}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && load(token)}
            className="bg-sf-card border border-sf-border rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none focus:border-sf-accent"
          />
          <button
            onClick={() => load(token)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-sf-border hover:border-sf-accent transition-colors disabled:opacity-50"
          >
            Run
          </button>
          <button
            onClick={() => setShowCompare(!showCompare)}
            className={clsx(
              "text-xs px-3 py-1.5 rounded border transition-colors",
              showCompare
                ? "bg-sf-accent text-sf-bg border-sf-accent"
                : "bg-sf-card text-sf-muted border-sf-border hover:border-sf-accent"
            )}
          >
            {showCompare ? "Hide Compare" : "Compare All"}
          </button>
        </div>
      </div>

      <div className="card p-3 border-sf-border">
        <p className="text-xs text-sf-muted">
          <span className="text-sf-accent font-medium">Experimental — not financial advice.</span>{" "}
          Backtests are deterministic rule simulations on historical klines. Results include assumed fees and
          slippage; past performance does not predict future results.
        </p>
      </div>

      {error && (
        <div className="card p-3 text-xs text-sf-danger font-mono">
          {error} — <button onClick={() => load(token)} className="underline text-sf-accent">retry</button>
        </div>
      )}

      {!strategies.length && !error && (
        <div className="card p-8 text-center text-xs text-sf-muted animate-pulse">Loading strategies…</div>
      )}

      {strategies.length > 0 && (
        <>
          <div className="flex gap-1 bg-sf-card p-1 rounded border border-sf-border w-fit">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                  active === s.id ? "bg-sf-bg text-sf-text" : "text-sf-muted hover:text-sf-text"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          {meta && (
            <div className="card p-3">
              <p className="text-sm font-medium">{meta.name}</p>
              <p className="text-xs text-sf-muted mt-1">{meta.description}</p>
            </div>
          )}

          {loading ? (
            <div className="card p-8 text-center text-xs text-sf-muted animate-pulse">Running backtest on live klines…</div>
          ) : bt && metricsRows.length > 0 ? (
            <>
              <div className="grid grid-cols-6 gap-3">
                {metricsRows.map((m) => (
                  <div key={m.label} className="card p-3">
                    <p className="text-[10px] text-sf-muted uppercase tracking-wider">{m.label}</p>
                    <p className={clsx("text-lg font-mono font-semibold mt-0.5", m.color)}>{m.value}</p>
                  </div>
                ))}
              </div>

              <div className="card p-3 text-[11px] text-sf-muted font-mono">
                {bt.token} · {bt.period} requested · {bt.actual_period} analyzed · fee {bt.config.fee_bps}bps · slippage {bt.config.slippage_bps}bps
              </div>

              <div className="card p-4">
                <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wider mb-3">Equity Curve ({bt.token} · $10k start)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#A1A1AA" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toLocaleString()} />
                    <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 6, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {showCompare
                      ? strategies.map((s, i) => {
                          const d = backtests[s.id];
                          if (!d) return null;
                          const colors = ["#22C55E", "#3B82F6", "#A855F7"];
                          return (
                            <Line key={s.id} data={d.equity_curve} type="monotone" dataKey="value" name={s.name} stroke={colors[i % colors.length]} strokeWidth={1.5} dot={false} />
                          );
                        })
                      : (
                          <Line data={bt.equity_curve} type="monotone" dataKey="value" name={meta?.name || active} stroke="#22C55E" strokeWidth={2} dot={false} />
                        )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="p-3 border-b border-sf-border">
                  <h3 className="text-sm font-medium">Trade History</h3>
                  {bt.trades.length === 0 && (
                    <p className="text-xs text-sf-muted mt-1">No trades triggered in this window — the rules stayed flat.</p>
                  )}
                </div>
                {bt.trades.length > 0 && (
                  <div className="divide-y divide-sf-border">
                    <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-sf-muted uppercase tracking-wider">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">Token</div>
                      <div className="col-span-2">Entry</div>
                      <div className="col-span-2">Exit</div>
                      <div className="col-span-2">P&L</div>
                      <div className="col-span-3">Entry / Exit Price</div>
                    </div>
                    {bt.trades.map((t) => (
                      <div key={t.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                        <div className="col-span-1 font-mono text-sf-muted">{t.id}</div>
                        <div className="col-span-2 font-mono font-medium">{t.token}</div>
                        <div className="col-span-2 font-mono text-sf-muted">{t.entry_date}</div>
                        <div className="col-span-2 font-mono text-sf-muted">{t.exit_date}</div>
                        <div className={clsx("col-span-2 font-mono font-medium", t.pnl_pct >= 0 ? "text-sf-accent" : "text-sf-danger")}>
                          {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct}%
                        </div>
                        <div className="col-span-3 font-mono text-xs text-sf-muted">
                          ${t.entry_price.toLocaleString()} → ${t.exit_price.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card p-8 text-center text-xs text-sf-muted">
              Backtest returned no data for this window. Try a different token or retry.
            </div>
          )}
        </>
      )}
    </div>
  );
}