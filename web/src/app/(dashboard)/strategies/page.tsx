"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import { Play, ArrowLeftRight, TrendingUp } from "lucide-react";
import { safeJson } from "@/lib/api";
import { ENABLE_BACKTESTS } from "@/lib/features";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
const CHART_COLORS = ["#22C55E", "#3B82F6", "#A855F7"];

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
      const stratData = await safeJson<{ strategies: StrategyMeta[] }>(stratRes, { strategies: [] });
      setStrategies(stratData.strategies || []);

      const results: Record<string, Backtest> = {};
      for (const s of stratData.strategies || []) {
        const res = await fetch(`/api/v1/strategy/${s.id}/backtest?token=${t}&period=90d`);
        if (res.ok) {
          const bt = await safeJson<Backtest>(res, {
            ok: true,
            strategy: s.id,
            token: t,
            period: "90d",
            actual_period: "",
            config: { fee_bps: 0, slippage_bps: 0 },
            disclaimer: "",
            experimental: true,
            metrics: { total_return: "0%", sharpe_ratio: 0, max_drawdown: "0%", win_rate: "0%", total_trades: 0, avg_trade_duration: "—" },
            equity_curve: [],
            trades: [],
          });
          if (bt.ok) results[s.id] = bt;
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Strategy Lab" subtitle="Deterministic backtests on real Binance klines" />
        <Card className="p-8 text-center">
          <p className="mb-2 text-sm font-medium text-brand">Experimental feature — disabled</p>
          <p className="text-xs text-text-secondary">
            Backtests are disabled in this deployment. Enable them by setting{" "}
            <span className="font-mono text-text">ENABLE_BACKTESTS=true</span> on the API and{" "}
            <span className="font-mono text-text">NEXT_PUBLIC_ENABLE_BACKTESTS=true</span> on the web build.
          </p>
        </Card>
      </div>
    );
  }

  const bt = backtests[active];
  const meta = strategies.find((s) => s.id === active);

  const metricsRows = bt
    ? [
        { label: "Total Return", value: bt.metrics.total_return, color: bt.metrics.total_return.startsWith("+") ? "text-positive" : "text-negative" },
        { label: "Sharpe Ratio", value: bt.metrics.sharpe_ratio.toFixed(2), color: "text-text" },
        { label: "Max Drawdown", value: bt.metrics.max_drawdown, color: "text-negative" },
        { label: "Win Rate", value: bt.metrics.win_rate, color: "text-text" },
        { label: "Total Trades", value: String(bt.metrics.total_trades), color: "text-text" },
        { label: "Avg Duration", value: bt.metrics.avg_trade_duration, color: "text-text-subtle" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy Lab"
        subtitle="Deterministic backtests on real Binance klines"
        badge={<Badge tone="warning"><TrendingUp className="h-3.5 w-3.5" /> Experimental</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={token}
              maxLength={10}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && load(token)}
              className="input font-mono w-24"
            />
            <Button size="md" variant="secondary" onClick={() => load(token)} loading={loading}>
              {!loading && <Play className="h-4 w-4" />} Run
            </Button>
            <Button size="md" variant={showCompare ? "primary" : "secondary"} onClick={() => setShowCompare(!showCompare)}>
              <ArrowLeftRight className="h-4 w-4" /> {showCompare ? "Hide Compare" : "Compare All"}
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <p className="text-xs text-text-secondary">
          <span className="font-medium text-warning">Experimental — not financial advice.</span>{" "}
          Backtests are deterministic rule simulations on historical klines. Results include assumed fees and
          slippage; past performance does not predict future results.
        </p>
      </Card>

      {error && (
        <Card className="p-4 text-sm text-negative font-mono">
          {error} — <button onClick={() => load(token)} className="underline text-brand">retry</button>
        </Card>
      )}

      {!strategies.length && !error && (
        <Card className="p-8 text-center text-xs text-text-subtle animate-pulse">Loading strategies…</Card>
      )}

      {strategies.length > 0 && (
        <>
          <div className="flex w-fit gap-1 rounded-md bg-surface-secondary p-1 ring-1 ring-inset ring-border">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={clsx(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  active === s.id ? "bg-surface text-text shadow-sm" : "text-text-secondary hover:text-text"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          {meta && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-text">{meta.name}</p>
              <p className="mt-1 text-xs text-text-secondary">{meta.description}</p>
            </Card>
          )}

          {loading ? (
            <Card className="p-8 text-center text-xs text-text-subtle animate-pulse">Running backtest on live klines…</Card>
          ) : bt && metricsRows.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {metricsRows.map((m) => (
                  <Card key={m.label} className="p-4">
                    <p className="text-[11px] uppercase tracking-wider text-text-subtle">{m.label}</p>
                    <p className={clsx("mt-1 font-mono text-lg font-semibold tabular-nums", m.color)}>{m.value}</p>
                  </Card>
                ))}
              </div>

              <Card className="p-3 font-mono text-[11px] text-text-subtle">
                {bt.token} · {bt.period} requested · {bt.actual_period} analyzed · fee {bt.config.fee_bps}bps · slippage {bt.config.slippage_bps}bps
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Equity Curve · {bt.token} · $10k start</CardTitle>
                </CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#98A2B3" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toLocaleString()} width={64} />
                      <Tooltip contentStyle={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 10, fontSize: 12, color: "var(--sf-text)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {showCompare
                        ? strategies.map((s, i) => {
                            const d = backtests[s.id];
                            if (!d) return null;
                            return (
                              <Line key={s.id} data={d.equity_curve} type="monotone" dataKey="value" name={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.5} dot={false} />
                            );
                          })
                        : (
                            <Line data={bt.equity_curve} type="monotone" dataKey="value" name={meta?.name || active} stroke="#22C55E" strokeWidth={2} dot={false} />
                          )}
                    </LineChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trade History</CardTitle>
                  {bt.trades.length === 0 && (
                    <p className="text-xs text-text-subtle">No trades triggered in this window — the rules stayed flat.</p>
                  )}
                </CardHeader>
                {bt.trades.length > 0 && (
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] uppercase tracking-wider text-text-subtle">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">Token</div>
                      <div className="col-span-2">Entry</div>
                      <div className="col-span-2">Exit</div>
                      <div className="col-span-2">P&L</div>
                      <div className="col-span-3">Entry / Exit Price</div>
                    </div>
                    {bt.trades.map((t) => (
                      <div key={t.id} className="grid grid-cols-12 gap-2 px-5 py-2.5 text-sm">
                        <div className="col-span-1 font-mono text-text-subtle">{t.id}</div>
                        <div className="col-span-2 font-mono font-medium text-text">{t.token}</div>
                        <div className="col-span-2 font-mono text-text-secondary">{t.entry_date}</div>
                        <div className="col-span-2 font-mono text-text-secondary">{t.exit_date}</div>
                        <div className={clsx("col-span-2 font-mono font-medium tabular-nums", t.pnl_pct >= 0 ? "text-positive" : "text-negative")}>
                          {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct}%
                        </div>
                        <div className="col-span-3 font-mono text-xs text-text-secondary">
                          ${t.entry_price.toLocaleString()} → ${t.exit_price.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center text-xs text-text-subtle">
              Backtest returned no data for this window. Try a different token or retry.
            </Card>
          )}
        </>
      )}
    </div>
  );
}