"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Fingerprint,
  Play,
  RefreshCw,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

type Probe = {
  code: string;
  label: string;
  method: string;
  path: string;
  thesis: string;
  status: number | null;
  ok: boolean | null;
  data: unknown;
  color: string;
};

const DEFS = [
  ["P-01", "Exact runtime binding", "GET", "/health", "Production identifies the exact deployed upstream commit and evidence policy.", "#3257FF"],
  ["P-02", "X-Agent verification", "GET", "/.well-known/xagent-verification.json", "Public verification binds the project slug to that same commit.", "#00C9E8"],
  ["P-03", "Agent capabilities", "GET", "/api/v1/capabilities", "The machine-readable contract exposes read-only tools, state model and authority boundary.", "#C6F432"],
  ["P-04", "Decision Packet", "GET", "/api/v1/decision/BTC", "Live packet exposes admission, lineage, lease, gate state and receipt.", "#6E46FF"],
  ["P-05", "Decision stress", "GET", "/api/v1/decision/BTC/stress", "Observed evidence can be removed to reveal fragility without invented replacements.", "#9278FF"],
  ["P-06", "Refusal recovery", "GET", "/api/v1/decision/BTC/recovery-plan", "A refusal produces evidence debt, safe reacquisition candidates and a refusal receipt.", "#FF8A1F"],
  ["P-07", "Receipt verification", "POST", "/api/v1/decision/verify-receipt", "The Decision Packet integrity digest verifies without a market-data fetch.", "#171522"],
  ["P-08", "Recovery verification", "POST", "/api/v1/decision/BTC/verify-recovery", "A prior refusal plan can be compared with fresh evidence to observe repair or non-repair.", "#E73DFF"],
  ["P-09", "Resilience benchmark", "GET", "/api/v1/evidence/resilience-benchmark", "Controlled policy-conformance cases prove fail-closed behavior, not trading accuracy.", "#FF4F73"],
  ["P-10", "Negative path", "GET", "/api/v1/evidence/negative-path", "Real external failure evidence is separated from the controlled refusal fixture.", "#FF4F73"],
  ["P-11", "Validation lab", "GET", "/api/v1/validation/BTC?period_days=120&horizon_days=3", "Calibration remains explicitly bounded to the price-derived 3-of-5 subset.", "#00AFC8"],
  ["P-12", "MCP discover", "POST", "/mcp", "The public runtime exposes the current stateless MCP protocol contract.", "#3257FF"],
  ["P-13", "MCP tools/list", "POST", "/mcp", "The read-only tool surface is discoverable over MCP.", "#6E46FF"],
  ["P-14", "MCP tools/call", "POST", "/mcp", "A real MCP call executes plan_evidence_recovery with no side effects or execution authority.", "#E73DFF"],
] as const;

function emptyProbes(): Probe[] {
  return DEFS.map(([code, label, method, path, thesis, color]) => ({ code, label, method, path, thesis, color, status: null, ok: null, data: null }));
}

async function readResponse(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}

function mcpBody(id: number, method: string, extra: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      ...extra,
    },
  };
}

export default function JudgeProofPage() {
  const [probes, setProbes] = useState<Probe[]>(emptyProbes);
  const [updatedAt, setUpdatedAt] = useState("");
  const [running, setRunning] = useState(false);

  const setProbe = useCallback((index: number, status: number, data: unknown) => {
    setProbes((previous) => previous.map((probe, probeIndex) => probeIndex === index ? { ...probe, status, ok: status >= 200 && status < 300, data } : probe));
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setProbes(emptyProbes());

    const get = async (index: number, path: string) => {
      try {
        const response = await fetch(path, { cache: "no-store" });
        const data = await readResponse(response);
        setProbe(index, response.status, data);
        return { response, data };
      } catch (error) {
        const data = { error: error instanceof Error ? error.message : "request failed" };
        setProbe(index, 0, data);
        return { response: null, data };
      }
    };

    const health = await get(0, "/health");
    void health;
    await get(1, "/.well-known/xagent-verification.json");
    await get(2, "/api/v1/capabilities");
    const decision = await get(3, "/api/v1/decision/BTC");
    await get(4, "/api/v1/decision/BTC/stress");
    const recovery = await get(5, "/api/v1/decision/BTC/recovery-plan");

    try {
      const response = await fetch("/api/v1/decision/verify-receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(decision.data) });
      setProbe(6, response.status, await readResponse(response));
    } catch (error) { setProbe(6, 0, { error: error instanceof Error ? error.message : "request failed" }); }

    try {
      const response = await fetch("/api/v1/decision/BTC/verify-recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recovery.data) });
      setProbe(7, response.status, await readResponse(response));
    } catch (error) { setProbe(7, 0, { error: error instanceof Error ? error.message : "request failed" }); }

    await get(8, "/api/v1/evidence/resilience-benchmark");
    await get(9, "/api/v1/evidence/negative-path");
    await get(10, "/api/v1/validation/BTC?period_days=120&horizon_days=3");

    const mcp = async (index: number, id: number, method: string, extra: Record<string, unknown> = {}, name?: string) => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method };
        if (name) headers["Mcp-Name"] = name;
        const response = await fetch("/mcp", { method: "POST", headers, body: JSON.stringify(mcpBody(id, method, extra)) });
        setProbe(index, response.status, await readResponse(response));
      } catch (error) { setProbe(index, 0, { error: error instanceof Error ? error.message : "request failed" }); }
    };

    await mcp(11, 12, "server/discover");
    await mcp(12, 13, "tools/list");
    await mcp(13, 14, "tools/call", { name: "plan_evidence_recovery", arguments: { token: "BTC" } }, "plan_evidence_recovery");

    setUpdatedAt(new Date().toISOString());
    setRunning(false);
  }, [setProbe]);

  useEffect(() => { void run(); }, [run]);

  const passCount = useMemo(() => probes.filter((probe) => probe.ok === true).length, [probes]);
  const failed = probes.filter((probe) => probe.ok === false).length;

  return (
    <main className="forge-shell min-h-screen px-5 py-7 text-text md:px-8 md:py-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="grid gap-7 border-b border-border/70 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-text-subtle hover:text-prism-violet"><ArrowLeft className="h-4 w-4" /> SIGNALFORGE</Link>
            <p className="forge-eyebrow mt-7">JUDGE PROOF CHAIN / LIVE RUNTIME</p>
            <h1 className="forge-display mt-5 max-w-6xl text-6xl font-semibold text-text md:text-9xl">Don&apos;t trust<br />the interface.</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-text-secondary">Probe the exact deployment, the evidence gate, the refusal lifecycle, integrity receipt and MCP contract directly. Each step calls the public runtime.</p>
          </div>
          <div className="forge-panel forge-cut min-w-[250px] p-5">
            <div className="flex items-center justify-between"><span className="atlas-micro">live proof state</span><Sparkles className="h-5 w-5 text-prism-lime" /></div>
            <p className="forge-display mt-4 font-mono text-7xl font-semibold text-text">{passCount}<span className="text-3xl text-text-subtle">/{probes.length}</span></p>
            <div className="mt-4 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.15em] text-text-subtle"><span>{failed ? `${failed} failed` : "all observed gates clean"}</span><span>{updatedAt ? updatedAt.slice(11,19) : "running"}</span></div>
            <Button className="mt-5 w-full" onClick={() => void run()} loading={running}><RefreshCw className="h-4 w-4" /> Re-run proof chain</Button>
          </div>
        </header>

        <section className="mt-8 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
          {[
            ["COMMIT", "exact upstream binding", "#3257FF"],
            ["EVIDENCE", "fail-closed lifecycle", "#00C9E8"],
            ["RECOVERY", "repair must be observed", "#E73DFF"],
            ["AUTHORITY", "execution / none", "#FF4F73"],
          ].map(([label, copy, color]) => <div key={label} className="relative bg-white/84 p-5"><span className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} /><p className="font-mono text-[9px] font-semibold tracking-[0.16em]" style={{ color }}>{label}</p><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}
        </section>

        <section className="mt-10 grid gap-8 xl:grid-cols-[.33fr_.67fr]">
          <div className="xl:sticky xl:top-8 xl:self-start">
            <p className="forge-eyebrow">LIVE SEQUENCE</p>
            <h2 className="forge-display mt-5 text-5xl font-semibold text-text md:text-7xl">Fourteen gates.<br />One chain of proof.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-text-secondary">The chain deliberately mixes positive and negative behavior. A refusal, unchanged recovery state or unavailable evidence can be a correct result.</p>
            <div className="mt-7 receipt-strip p-4">
              <div className="flex items-center gap-2"><ShieldOff className="h-4 w-4 text-prism-coral" /><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-prism-coral">execution_authorized:false</span></div>
              <p className="mt-3 text-xs leading-5 text-[#c8c4d8]">The proof surface validates research behavior. It never turns SignalForge into an execution system.</p>
            </div>
          </div>

          <div className="space-y-6">
            {probes.map((probe) => (
              <article key={probe.code} className="proof-step">
                <div className="forge-panel overflow-hidden">
                  <div className="grid gap-4 p-5 md:grid-cols-[64px_1fr_auto] md:items-start md:p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white font-mono text-[9px] font-semibold shadow-card" style={{ background: probe.color }}>{probe.code.slice(2)}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[8px] font-semibold uppercase tracking-[0.16em]" style={{ color: probe.color }}>{probe.code}</span><span className="font-mono text-[8px] uppercase tracking-[0.14em] text-text-subtle">{probe.method} {probe.path}</span></div>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-text">{probe.label}</h3>
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-text-secondary">{probe.thesis}</p>
                    </div>
                    <div className={`flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${probe.ok === true ? "text-positive" : probe.ok === false ? "text-prism-coral" : "text-text-subtle"}`}>
                      {probe.ok === true ? <CheckCircle2 className="h-5 w-5" /> : probe.ok === false ? <AlertTriangle className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      {probe.status == null ? "running" : probe.status === 0 ? "offline" : `HTTP ${probe.status}`}
                    </div>
                  </div>
                  <details className="group border-t border-border/70 bg-[#171522] text-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[#aaa5c2] md:px-6"><span>raw runtime evidence</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                    <pre className="max-h-[30rem] overflow-auto border-t border-white/10 p-5 font-mono text-[10px] leading-5 text-[#e7e3f3] md:p-6">{probe.data === null ? "Running live probe…" : JSON.stringify(probe.data, null, 2)}</pre>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["OBSERVED", "Live endpoint response, deployment binding or sourced historical fact.", "#00C9E8"],
            ["INFERRED", "A bounded interpretation produced from observed evidence; never relabelled as raw fact.", "#6E46FF"],
            ["UNKNOWN", "Counterfactual behavior and unmeasured outcomes remain explicit instead of being filled with narrative.", "#FF8A1F"],
          ].map(([label, copy, color]) => <div key={label} className="forge-panel p-5" style={{ boxShadow: `inset 0 6px 0 ${color}` }}><p className="font-mono text-[9px] font-semibold tracking-[0.17em]" style={{ color }}>{label}</p><p className="mt-3 text-sm leading-6 text-text-secondary">{copy}</p></div>)}
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 py-6 font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">
          <span>Real failure facts ≠ controlled fixture ≠ historical replay</span>
          <span className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-prism-ink" /> receipt integrity ≠ signature ≠ external truth</span>
        </footer>
      </div>
    </main>
  );
}
