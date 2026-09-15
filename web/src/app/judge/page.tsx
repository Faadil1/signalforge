"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  ShieldCheck,
  Ban,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { Button } from "@/components/ui/Button";

const TARGETS = [
  { code: "P-01", label: "Deployment binding", path: "/health", thesis: "Runtime identifies the deployed commit and evidence policy." },
  { code: "P-02", label: "X-Agent verification", path: "/.well-known/xagent-verification.json", thesis: "Public verification binds project slug to exact commit." },
  { code: "P-03", label: "Decision Packet", path: "/api/v1/decision/BTC", thesis: "Live packet exposes score, coverage, provenance and no execution authority." },
  { code: "P-04", label: "Signal Delta", path: "/api/v1/decision/BTC/delta", thesis: "Material change is separated from repeated observation." },
  { code: "P-05", label: "Validation Lab", path: "/api/v1/validation/BTC?period_days=120&horizon_days=3", thesis: "Calibration is explicitly bounded to price-derived 3/5 evidence." },
  { code: "P-06", label: "Negative Path", path: "/api/v1/evidence/negative-path", thesis: "Controlled degraded evidence forces abstention instead of false confidence." },
];

type Probe = {
  code: string;
  label: string;
  path: string;
  thesis: string;
  status: number | null;
  data: unknown;
};

export default function JudgeProofPage() {
  const [probes, setProbes] = useState<Probe[]>(TARGETS.map((target) => ({ ...target, status: null, data: null })));
  const [updatedAt, setUpdatedAt] = useState("");
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const next = await Promise.all(
      TARGETS.map(async (target) => {
        try {
          const response = await fetch(target.path, { cache: "no-store" });
          const text = await response.text();
          let data: unknown = text;
          try {
            data = JSON.parse(text);
          } catch {
            // Raw body remains valid diagnostic evidence.
          }
          return { ...target, status: response.status, data };
        } catch (error) {
          return { ...target, status: 0, data: { error: error instanceof Error ? error.message : "request failed" } };
        }
      })
    );
    setProbes(next);
    setUpdatedAt(new Date().toISOString());
    setRunning(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const passCount = useMemo(() => probes.filter((probe) => probe.status != null && probe.status >= 200 && probe.status < 300).length, [probes]);

  return (
    <main className="atlas-shell min-h-screen bg-surface-app px-5 py-7 text-text md:px-8 md:py-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="grid gap-6 border-b border-border pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link href="/" className="field-label hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" /> SIGNALFORGE</Link>
            <p className="mt-6 field-label">JUDGE PROOF DOSSIER / LIVE RUNTIME</p>
            <h1 className="mt-4 max-w-5xl text-5xl font-semibold leading-[0.96] tracking-[-0.055em] md:text-7xl">Evidence before recommendation.<br />Refusal before false confidence.</h1>
            <p className="mt-6 max-w-3xl text-sm leading-6 text-text-secondary md:text-base">A live proof surface for exact deployment binding, evidence-gated decision packets, bounded validation and a negative path rooted in a real external failure without pretending to replay history.</p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="border border-border bg-surface/70 px-4 py-3 text-right">
              <p className="atlas-micro">proof state</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-text">{passCount}/6</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-text-subtle">{updatedAt || "running first pass"}</p>
            </div>
            <Button onClick={() => void run()} loading={running}><RefreshCw className="h-4 w-4" /> Re-run live proof</Button>
          </div>
        </header>

        <section className="mt-7 grid gap-4 lg:grid-cols-12">
          <AtlasPanel label="Thesis" code="D-01" tone="live" className="lg:col-span-5">
            <div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-6 w-6 text-brand" /><div><h2 className="text-2xl font-semibold tracking-[-0.03em] text-text">AVAILABLE does not imply ACTIONABLE.</h2><p className="mt-3 text-sm leading-6 text-text-secondary">SignalForge treats source freshness, consistency, coverage and actionability as separate states. The UI keeps those boundaries visible instead of compressing them into one confidence-looking number.</p></div></div>
          </AtlasPanel>

          <AtlasPanel label="Observed External" code="D-02" tone="warning" className="lg:col-span-4">
            <div className="flex items-start gap-3"><Database className="mt-0.5 h-5 w-5 text-warning" /><div><p className="text-sm font-semibold text-text">AWS Tokyo / Binance — 2025-04-15</p><p className="mt-2 text-xs leading-5 text-text-secondary">The real incident motivates the failure class. SignalForge does not claim it captured or replayed that historical event.</p></div></div>
          </AtlasPanel>

          <AtlasPanel label="Authority Boundary" code="D-03" tone="critical" className="lg:col-span-3">
            <Ban className="h-5 w-5 text-negative" /><p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-text">No execution authority.</p><p className="mt-2 text-xs leading-5 text-text-secondary">Every decision packet keeps execution_authorized false.</p>
          </AtlasPanel>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="field-label">LIVE PROBE MATRIX</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-text">Six surfaces. One proof chain.</h2></div>
            <span className="atlas-stamp atlas-stamp-live">REMOTE RUNTIME / NO FIXTURE FOR LIVE GATES</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {probes.map((probe) => {
              const ok = probe.status != null && probe.status >= 200 && probe.status < 300;
              return (
                <AtlasPanel
                  key={probe.path}
                  label={probe.label}
                  code={probe.code}
                  tone={probe.status === null ? "quiet" : ok ? "live" : "critical"}
                  meta={probe.status === null ? "LOADING" : probe.status === 0 ? "OFFLINE" : `HTTP ${probe.status}`}
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                    <div>
                      <p className="font-mono text-[10px] text-text-subtle">GET {probe.path}</p>
                      <p className="mt-2 text-xs leading-5 text-text-secondary">{probe.thesis}</p>
                    </div>
                    <div className={ok ? "text-positive" : probe.status === null ? "text-text-subtle" : "text-negative"}>
                      {ok ? <CheckCircle2 className="h-5 w-5" /> : probe.status === null ? <ScanLine className="h-5 w-5 animate-evidence-pulse" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                  </div>
                  <pre className="mt-4 max-h-[24rem] overflow-auto border border-border bg-[#202b27] p-4 font-mono text-[10px] leading-5 text-[#dbe6e1]">
                    {probe.data === null ? "Running live probe…" : JSON.stringify(probe.data, null, 2)}
                  </pre>
                </AtlasPanel>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            ["OBSERVED", "Live endpoint response, deployment binding, or sourced historical fact."],
            ["INFERRED", "Interpretation produced from observed evidence; never relabelled as raw fact."],
            ["UNKNOWN", "Counterfactual behavior and unmeasured outcomes remain explicitly unknown."],
          ].map(([label, copy], index) => (
            <div key={label} className="border-t border-border pt-4">
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-brand">{label}</span><span className="font-mono text-[9px] text-text-subtle">EPI-0{index + 1}</span></div>
              <p className="mt-3 text-xs leading-5 text-text-secondary">{copy}</p>
            </div>
          ))}
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-[10px] uppercase tracking-[0.13em] text-text-subtle">
          <span>Validation remains price-derived 3/5 · no full-composite profitability claim</span>
          <span className="font-mono">Real failure facts ≠ controlled fixture ≠ historical replay</span>
        </footer>
      </div>
    </main>
  );
}
