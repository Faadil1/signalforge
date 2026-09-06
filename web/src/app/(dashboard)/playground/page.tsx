"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";

type Endpoint = { method: "GET" | "POST" | "DELETE"; path: string; description: string };
type Usage = {
  total_calls: number;
  calls_today: number;
  avg_latency_ms: number;
  uptime_s: number;
  top_endpoints: { path: string; count: number }[];
};

const METHOD_COLOR = {
  GET: "bg-sf-accent/15 text-sf-accent",
  POST: "bg-blue-500/15 text-blue-400",
  DELETE: "bg-sf-danger/15 text-sf-danger",
};

export default function PlaygroundPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [selected, setSelected] = useState(0);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("BTC");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [epRes, usageRes] = await Promise.all([
        fetch("/api/v1/playground/endpoints"),
        fetch("/api/v1/playground/usage"),
      ]);
      if (!epRes.ok || !usageRes.ok) throw new Error("Failed to load playground data");
      const ep = await epRes.json();
      const us = await usageRes.json();
      setEndpoints(ep.endpoints || []);
      setUsage(us);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const endpoint = endpoints[selected];

  const handleSend = async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const path = endpoint.path
        .replace("{token}", tokenInput.toUpperCase())
        .replace("{id}", "momentum")
        .replace("{alert_id}", "__placeholder__");
      const res = await fetch(`${path}`, {
        method: endpoint.method,
        headers: endpoint.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body:
          endpoint.method === "POST"
            ? JSON.stringify({ token: tokenInput.toUpperCase(), condition: "gte", threshold: 50 })
            : undefined,
      });
      const elapsed = Math.round(performance.now() - startedAt);
      setStatus(res.status);
      setLatency(elapsed);
      const text = await res.text();
      setResponse(res.ok ? text : text || res.statusText);
      if (res.status === 401) {
        setResponse(JSON.stringify({ error: "Auth required — this endpoint needs an API key to reach its live data source." }, null, 2));
      }
    } catch (e) {
      setStatus(0);
      setLatency(Math.round(performance.now() - startedAt));
      setResponse(JSON.stringify({ error: e instanceof Error ? e.message : "Request failed" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const uptimeHours = usage ? Math.round(usage.uptime_s / 3600) : 0;

  const STATS = usage
    ? [
        { label: "Calls Total", value: usage.total_calls.toLocaleString(), sub: "since start" },
        { label: "Calls Today", value: usage.calls_today.toLocaleString(), sub: "24h" },
        { label: "Avg Latency", value: `${Math.round(usage.avg_latency_ms)}ms`, sub: "last 24h" },
        { label: "Uptime", value: `${uptimeHours}h`, sub: "process" },
        { label: "Top Endpoint", value: usage.top_endpoints[0]?.path.replace("/api/v1/", "") || "—", sub: `${usage.top_endpoints[0]?.count || 0} calls` },
        { label: "Data Source", value: "Binance", sub: "free public API" },
      ]
    : [0, 1, 2, 3, 4, 5].map((i) => ({ label: `—`, value: "·", sub: "…" }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">API Playground</h1>
          <p className="text-sm text-sf-muted">Interactive live tester for SignalForge endpoints</p>
        </div>
        <button onClick={load} className="text-xs text-sf-muted px-3 py-1.5 rounded border border-sf-border hover:border-sf-accent transition-colors">
          Refresh
        </button>
      </div>

      {error && (
        <div className="card p-3 text-xs text-sf-danger font-mono">
          {error} — <button onClick={load} className="underline text-sf-accent">retry</button>
        </div>
      )}

      <div className="grid grid-cols-6 gap-3">
        {STATS.map((s) => (
          <div key={s.label + s.value} className="card p-3">
            <p className="text-[10px] text-sf-muted uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-mono font-semibold mt-0.5 truncate">{s.value}</p>
            <p className="text-[10px] text-sf-muted truncate">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="p-3 border-b border-sf-border">
            <h3 className="text-sm font-medium">Request Builder</h3>
          </div>

          <div className="border-b border-sf-border max-h-48 overflow-y-auto">
            {endpoints.map((ep, i) => (
              <div
                key={i}
                onClick={() => setSelected(i)}
                className={clsx(
                  "flex items-start gap-2 px-3 py-2 text-xs cursor-pointer transition-colors border-l-2",
                  selected === i ? "bg-sf-bg border-l-sf-accent" : "border-l-transparent hover:bg-sf-bg/50"
                )}
              >
                <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-mono font-medium shrink-0", METHOD_COLOR[ep.method])}>
                  {ep.method}
                </span>
                <div className="min-w-0">
                  <span className="font-mono text-sf-muted truncate block">{ep.path}</span>
                  <span className="text-[10px] text-sf-muted block">{ep.description}</span>
                </div>
              </div>
            ))}
            {!endpoints.length && (
              <div className="p-4 text-center text-xs text-sf-muted animate-pulse">Loading endpoints…</div>
            )}
          </div>

          <div className="p-3 space-y-3">
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Token</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sf-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Request</label>
              <div className="bg-sf-bg border border-sf-border rounded p-2 text-xs font-mono text-sf-muted">
                <div>{endpoint ? `${endpoint.method} ${endpoint.path}` : "—"}</div>
                <div>Content-Type: application/json</div>
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !endpoint}
              className="w-full bg-sf-accent text-sf-bg text-xs font-medium py-2 rounded hover:bg-sf-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Request"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="p-3 border-b border-sf-border flex items-center justify-between">
            <h3 className="text-sm font-medium">Response</h3>
            <div className="flex items-center gap-3 text-xs">
              {status != null && (
                <span className={clsx("font-mono font-medium", status >= 200 && status < 300 ? "text-sf-accent" : "text-sf-danger")}>
                  {status}
                </span>
              )}
              {latency != null && <span className="text-sf-muted font-mono">{latency}ms</span>}
            </div>
          </div>
          <div className="p-3">
            {response ? (
              <pre className="bg-sf-bg border border-sf-border rounded p-3 text-xs font-mono text-sf-muted overflow-x-auto max-h-[27rem] overflow-y-auto whitespace-pre-wrap break-all">
                {response}
              </pre>
            ) : (
              <div className="bg-sf-bg border border-sf-border rounded p-3 text-xs text-sf-muted h-40 flex items-center justify-center">
                {loading ? "Fetching live response…" : "Select an endpoint and send a request"}
              </div>
            )}
          </div>
          {usage && usage.top_endpoints.length > 0 && (
            <div className="p-3 border-t border-sf-border">
              <p className="text-[10px] text-sf-muted uppercase tracking-wider mb-2">Top Endpoints by Calls</p>
              <div className="space-y-1">
                {usage.top_endpoints.slice(0, 4).map((te) => (
                  <div key={te.path} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-sf-muted truncate">{te.path}</span>
                    <span className="font-mono text-sf-accent">{te.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}