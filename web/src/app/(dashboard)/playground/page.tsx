"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { RefreshCw, Send, Terminal, CheckCircle2 } from "lucide-react";
import { safeJson } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Endpoint = { method: "GET" | "POST" | "DELETE"; path: string; description: string };
type Usage = {
  total_calls: number;
  calls_today: number;
  avg_latency_ms: number;
  uptime_s: number;
  top_endpoints: { path: string; count: number }[];
};

const METHOD_TONE = {
  GET: "positive",
  POST: "info",
  DELETE: "negative",
} as const;

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
      const ep = await safeJson<{ endpoints: Endpoint[] }>(epRes, { endpoints: [] });
      const us = await safeJson<Usage>(usageRes, {
        total_calls: 0, calls_today: 0, avg_latency_ms: 0, uptime_s: 0, top_endpoints: [],
      });
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
      ]
    : [0, 1, 2, 3].map((i) => ({ label: "—", value: "·", sub: "…" }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent API"
        subtitle="Interactive live tester for SignalForge endpoints"
        badge={<Badge tone="info"><Terminal className="h-3.5 w-3.5" /> Playground</Badge>}
        actions={
          <Button size="md" variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        }
      />

      {error && (
        <Card className="p-4 text-sm text-negative font-mono">
          {error} — <button onClick={load} className="underline text-brand">retry</button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label + s.value} className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-text-subtle">{s.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-text">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-text-subtle">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Request Builder</CardTitle></CardHeader>
          <div className="max-h-52 overflow-y-auto border-b border-border px-2 py-2">
            {endpoints.map((ep, i) => (
              <div
                key={i}
                onClick={() => setSelected(i)}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                  selected === i ? "bg-surface-secondary ring-1 ring-inset ring-border" : "hover:bg-surface-secondary/60"
                )}
              >
                <Badge tone={METHOD_TONE[ep.method]} className="font-mono w-14 justify-center">{ep.method}</Badge>
                <div className="min-w-0">
                  <span className="block truncate font-mono text-text">{ep.path}</span>
                  <span className="block text-[11px] text-text-subtle">{ep.description}</span>
                </div>
              </div>
            ))}
            {!endpoints.length && (
              <div className="p-4 text-center text-xs text-text-subtle animate-pulse">Loading endpoints…</div>
            )}
          </div>

          <CardBody className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Token</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Request</label>
              <div className="rounded-md bg-surface-secondary p-3 font-mono text-xs text-text-secondary ring-1 ring-inset ring-border">
                <div>{endpoint ? `${endpoint.method} ${endpoint.path}` : "—"}</div>
                <div className="text-text-subtle">Content-Type: application/json</div>
              </div>
            </div>
            <Button onClick={handleSend} disabled={loading || !endpoint} loading={loading} className="w-full">
              {!loading && <Send className="h-4 w-4" />} {loading ? "Sending…" : "Send Request"}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              {status != null && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-medium",
                    status >= 200 && status < 300 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                  )}
                >
                  {status >= 200 && status < 300 && <CheckCircle2 className="h-3 w-3" />}
                  {status}
                </span>
              )}
              {latency != null && <span className="font-mono text-text-subtle">{latency}ms</span>}
            </div>
          </CardHeader>
          <CardBody>
            {response ? (
              <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-secondary p-4 font-mono text-[13px] text-text-secondary ring-1 ring-inset ring-border">
                {response}
              </pre>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-md bg-surface-secondary text-xs text-text-subtle ring-1 ring-inset ring-border">
                {loading ? "Fetching live response…" : "Select an endpoint and send a request"}
              </div>
            )}
          </CardBody>
          {usage && usage.top_endpoints.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-text-subtle">Top Endpoints by Calls</p>
              <div className="space-y-1.5">
                {usage.top_endpoints.slice(0, 4).map((te) => (
                  <div key={te.path} className="flex items-center justify-between text-xs">
                    <span className="truncate font-mono text-text-secondary">{te.path}</span>
                    <span className="font-mono tabular-nums text-brand">{te.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
