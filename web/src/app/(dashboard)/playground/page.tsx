"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Braces, CheckCircle2, RefreshCw, Send, Terminal } from "lucide-react";
import { safeJson } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";

type Endpoint = { method: "GET" | "POST" | "DELETE"; path: string; description: string };
type Usage = {
  total_calls: number;
  calls_today: number;
  avg_latency_ms: number;
  uptime_s: number;
  top_endpoints: { path: string; count: number }[];
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
      const [endpointRes, usageRes] = await Promise.all([
        fetch("/api/v1/playground/endpoints"),
        fetch("/api/v1/playground/usage"),
      ]);
      if (!endpointRes.ok || !usageRes.ok) throw new Error("Agent interface metadata unavailable");
      const endpointData = await safeJson<{ endpoints: Endpoint[] }>(endpointRes, { endpoints: [] });
      const usageData = await safeJson<Usage>(usageRes, { total_calls: 0, calls_today: 0, avg_latency_ms: 0, uptime_s: 0, top_endpoints: [] });
      setEndpoints(endpointData.endpoints || []);
      setUsage(usageData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load agent interface");
    }
  }, []);

  useEffect(() => {
    void load();
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
      const res = await fetch(path, {
        method: endpoint.method,
        headers: endpoint.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: endpoint.method === "POST" ? JSON.stringify({ token: tokenInput.toUpperCase(), condition: "gte", threshold: 50 }) : undefined,
      });
      setStatus(res.status);
      setLatency(Math.round(performance.now() - startedAt));
      const text = await res.text();
      setResponse(text || res.statusText);
    } catch (cause) {
      setStatus(0);
      setLatency(Math.round(performance.now() - startedAt));
      setResponse(JSON.stringify({ error: cause instanceof Error ? cause.message : "Request failed" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const stats = usage
    ? [
        { id: "calls", label: "process calls", value: usage.total_calls.toLocaleString(), sub: "current isolate" },
        { id: "today", label: "calls today", value: usage.calls_today.toLocaleString(), sub: "process-local" },
        { id: "latency", label: "mean latency", value: `${Math.round(usage.avg_latency_ms)}ms`, sub: "local sample" },
        { id: "scope", label: "telemetry scope", value: "LOCAL", sub: "not global uptime" },
      ]
    : [0, 1, 2, 3].map((index) => ({ id: `loading-${index}`, label: "loading", value: "—", sub: "awaiting isolate" }));

  return (
    <div className="space-y-5">
      <header className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="field-label">04 / AGENT INTERFACE</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-text md:text-5xl">Interrogate the live contract.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Send real requests against the same evidence surfaces used by the UI. Usage counters are intentionally labelled process-local.</p></div>
        <Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh metadata</Button>
      </header>

      {error && <div className="border border-negative/40 bg-negative/5 px-4 py-3 font-mono text-[11px] text-negative">INTERFACE ERROR / {error}</div>}

      <div className="survey-strip">
        {stats.map((stat) => <div key={stat.id} className="survey-cell col-span-6 sm:col-span-3"><p className="atlas-micro">{stat.label}</p><p className="mt-1 font-mono text-2xl font-semibold text-text">{stat.value}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-text-subtle">{stat.sub}</p></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <AtlasPanel label="Endpoint Index" code="API-A" meta={`${endpoints.length} routes`} className="xl:col-span-5">
          <div className="max-h-[520px] overflow-y-auto border-y border-border">
            {endpoints.map((item, index) => (
              <button key={`${item.method}-${item.path}`} type="button" onClick={() => setSelected(index)} className={clsx("grid w-full grid-cols-[54px_1fr] gap-3 border-b border-border px-2 py-3 text-left last:border-b-0", selected === index ? "bg-brand/[0.055]" : "hover:bg-surface-secondary/45")}>
                <span className={clsx("font-mono text-[10px] font-semibold", item.method === "GET" ? "text-positive" : item.method === "POST" ? "text-brand" : "text-negative")}>{item.method}</span>
                <div><p className="truncate font-mono text-[11px] text-text">{item.path}</p><p className="mt-1 text-[10px] leading-4 text-text-subtle">{item.description}</p></div>
              </button>
            ))}
            {!endpoints.length && <div className="py-10 text-center font-mono text-[10px] text-text-subtle">LOADING ENDPOINT INDEX…</div>}
          </div>
        </AtlasPanel>

        <AtlasPanel label="Request Constructor" code="API-B" tone="quiet" className="xl:col-span-3">
          <div className="space-y-4">
            <div><label className="atlas-micro">token</label><input className="input mt-2 font-mono" value={tokenInput} onChange={(event) => setTokenInput(event.target.value.toUpperCase())} /></div>
            <div><p className="atlas-micro">request</p><div className="mt-2 border border-border bg-surface-secondary/55 p-3 font-mono text-[10px] leading-5 text-text-secondary">{endpoint ? `${endpoint.method} ${endpoint.path}` : "—"}<br /><span className="text-text-subtle">Content-Type: application/json</span></div></div>
            <Button className="w-full" onClick={() => void handleSend()} disabled={!endpoint || loading} loading={loading}>{!loading && <Send className="h-4 w-4" />} Send live request</Button>
            <div className="border-t border-border pt-4"><div className="flex items-start gap-3"><Braces className="mt-0.5 h-4 w-4 text-brand" /><p className="text-[11px] leading-5 text-text-subtle">Responses are presented raw so provenance, actionability and execution authority remain inspectable.</p></div></div>
          </div>
        </AtlasPanel>

        <AtlasPanel label="Response Buffer" code="API-C" tone={status != null && status >= 200 && status < 300 ? "live" : status == null ? "default" : "critical"} meta={status == null ? "IDLE" : `${status} / ${latency ?? 0}MS`} className="xl:col-span-4">
          {response ? <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-all border border-border bg-[#202b27] p-4 font-mono text-[10px] leading-5 text-[#dbe6e1]">{response}</pre> : <div className="flex min-h-[280px] items-center justify-center text-center"><div><Terminal className="mx-auto h-6 w-6 text-text-subtle" /><p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">response buffer empty</p></div></div>}
          {status != null && <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-text-subtle">{status >= 200 && status < 300 && <CheckCircle2 className="h-3.5 w-3.5 text-positive" />}HTTP {status} · {latency}ms</div>}
        </AtlasPanel>
      </div>
    </div>
  );
}
