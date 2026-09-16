"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Braces, CheckCircle2, RefreshCw, Send, ShieldOff, Terminal, Wrench } from "lucide-react";
import { safeJson } from "@/lib/api";
import { Button } from "@/components/ui/Button";

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
      if (!endpointRes.ok || !usageRes.ok) throw new Error("Agent contract metadata unavailable");
      const endpointData = await safeJson<{ endpoints: Endpoint[] }>(endpointRes, { endpoints: [] });
      const usageData = await safeJson<Usage>(usageRes, { total_calls: 0, calls_today: 0, avg_latency_ms: 0, uptime_s: 0, top_endpoints: [] });
      setEndpoints(endpointData.endpoints || []);
      setUsage(usageData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load agent contract");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
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
      setResponse((await res.text()) || res.statusText);
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
        ["process calls", usage.total_calls.toLocaleString(), "current isolate", "#3257FF"],
        ["calls today", usage.calls_today.toLocaleString(), "process-local", "#00C9E8"],
        ["mean latency", `${Math.round(usage.avg_latency_ms)}ms`, "local sample", "#C6F432"],
        ["authority", "NONE", "read-only research", "#FF4F73"],
      ]
    : [["loading", "—", "awaiting isolate", "#B9C6F2"]];

  return (
    <div className="space-y-7">
      <header className="grid gap-6 border-b border-border/70 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="forge-eyebrow">09 / AGENT CONTRACT</p>
          <h1 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">Call the evidence machine directly.</h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">A live request surface for the same read-only contracts used by the interface. Raw responses remain visible so provenance, refusal and authority boundaries cannot be hidden by presentation.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh contract</Button>
      </header>

      {error && <div className="border border-prism-coral/40 bg-prism-coral/10 px-4 py-3 font-mono text-[10px] text-prism-coral">CONTRACT ERROR / {error}</div>}

      <section className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
        {stats.map(([label, value, sub, color]) => (
          <div key={label} className="relative bg-white/80 p-4">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
            <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-text-subtle">{label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-text">{value}</p>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-text-subtle">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[.34fr_.66fr]">
        <div className="forge-panel overflow-hidden">
          <div className="border-b border-border/70 bg-white/60 px-5 py-4">
            <div className="flex items-center gap-2"><Braces className="h-5 w-5 text-prism-magenta" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-magenta">CONTRACT INDEX</span></div>
            <p className="mt-2 text-xs text-text-secondary">{endpoints.length} public REST surfaces exposed by this runtime.</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto divide-y divide-border/70">
            {endpoints.map((item, index) => (
              <button
                key={`${item.method}-${item.path}`}
                type="button"
                onClick={() => setSelected(index)}
                className={clsx(
                  "grid w-full grid-cols-[58px_1fr] gap-3 px-5 py-4 text-left transition-[background-color,box-shadow]",
                  selected === index ? "bg-prism-magenta/[0.08] shadow-[inset_5px_0_0_#E73DFF]" : "bg-white/30 hover:bg-white/70"
                )}
              >
                <span className={clsx("font-mono text-[9px] font-semibold", item.method === "GET" ? "text-prism-cobalt" : item.method === "POST" ? "text-prism-magenta" : "text-prism-coral")}>{item.method}</span>
                <div><p className="break-all font-mono text-[10px] font-semibold text-text">{item.path}</p><p className="mt-1 text-[10px] leading-4 text-text-subtle">{item.description}</p></div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[.36fr_.64fr]">
          <div className="forge-panel p-5 md:p-6">
            <div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-prism-violet" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-prism-violet">REQUEST CONSTRUCTOR</span></div>
            <div className="mt-6"><label className="atlas-micro">token input</label><input className="input mt-2 font-mono" value={tokenInput} onChange={(event) => setTokenInput(event.target.value.toUpperCase())} /></div>
            <div className="mt-5"><p className="atlas-micro">selected request</p><div className="mt-2 border border-border bg-white/70 p-4 font-mono text-[10px] leading-5 text-text-secondary">{endpoint ? `${endpoint.method} ${endpoint.path}` : "—"}</div></div>
            <Button className="mt-5 w-full" onClick={() => void handleSend()} disabled={!endpoint || loading} loading={loading}>{!loading && <Send className="h-4 w-4" />} Send live request</Button>
            <div className="mt-6 border-t border-border/70 pt-4"><div className="flex items-start gap-2 text-prism-coral"><ShieldOff className="mt-0.5 h-4 w-4 shrink-0" /><p className="font-mono text-[8px] uppercase leading-4 tracking-[0.13em]">No request on this surface grants execution authority.</p></div></div>
          </div>

          <div className="receipt-strip min-h-[440px] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Terminal className="h-5 w-5 text-prism-lime" /><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.17em] text-prism-lime">RAW RESPONSE BUFFER</span></div><span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#827c9b]">{status == null ? "idle" : `HTTP ${status} · ${latency ?? 0}ms`}</span></div>
            {response ? <pre className="mt-5 max-h-[540px] overflow-auto whitespace-pre-wrap break-all border-t border-white/10 pt-5 font-mono text-[10px] leading-5 text-[#e7e3f3]">{response}</pre> : <div className="flex min-h-[340px] items-center justify-center text-center"><div><Terminal className="mx-auto h-8 w-8 text-[#827c9b]" /><p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[#827c9b]">select a contract and send a live request</p></div></div>}
            {status != null && <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4 font-mono text-[9px] text-[#aaa5c2]">{status >= 200 && status < 300 && <CheckCircle2 className="h-4 w-4 text-prism-lime" />}HTTP {status} · {latency}ms</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
