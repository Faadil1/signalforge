"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Database, FileCheck2, ShieldCheck, Zap } from "lucide-react";

const TARGETS = [
  { label: "Deployment binding", path: "/health" },
  { label: "X-Agent verification", path: "/.well-known/xagent-verification.json" },
  { label: "Decision Packet", path: "/api/v1/decision/BTC" },
  { label: "Signal Delta", path: "/api/v1/decision/BTC/delta" },
  { label: "Validation Lab", path: "/api/v1/validation/BTC?period_days=120&horizon_days=3" },
];

type Probe = {
  label: string;
  path: string;
  status: number | null;
  data: unknown;
};

export default function JudgeProofPage() {
  const [probes, setProbes] = useState<Probe[]>(TARGETS.map((target) => ({ ...target, status: null, data: null })));
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const run = useCallback(async () => {
    const next = await Promise.all(
      TARGETS.map(async (target) => {
        try {
          const response = await fetch(target.path, { cache: "no-store" });
          const text = await response.text();
          let data: unknown = text;
          try {
            data = JSON.parse(text);
          } catch {
            // Keep raw response for proof/debugging.
          }
          return { ...target, status: response.status, data };
        } catch (error) {
          return {
            ...target,
            status: 0,
            data: { error: error instanceof Error ? error.message : "request failed" },
          };
        }
      })
    );
    setProbes(next);
    setUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <main className="min-h-screen bg-surface-app px-5 py-8 text-text md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text">
              <ArrowLeft className="h-4 w-4" /> Back to SignalForge
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Judge proof surface</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Evidence before recommendation.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary md:text-base">
              This page exercises the exact deployment binding, agent decision contract, material-change layer,
              and historical calibration that reviewers can call independently.
            </p>
          </div>
          <button
            onClick={() => void run()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Re-run proof
          </button>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Database,
              title: "Real data",
              copy: "Production fails closed instead of silently fabricating Binance evidence.",
            },
            {
              icon: ShieldCheck,
              title: "Confidence gated",
              copy: "Directional stance can be withheld when coverage or confidence is insufficient.",
            },
            {
              icon: Zap,
              title: "Agent native",
              copy: "Decision Packets expose evidence, contradictions, horizon, regime and invalidation.",
            },
            {
              icon: FileCheck2,
              title: "No authority",
              copy: "Every agent packet declares execution_authorized: false.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="card p-4">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{copy}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {probes.map((probe) => {
            const ok = probe.status !== null && probe.status >= 200 && probe.status < 300;
            return (
              <section key={probe.path} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{probe.label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-subtle">GET {probe.path}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {ok && <CheckCircle2 className="h-4 w-4 text-positive" />}
                    <span
                      className={
                        ok ? "text-positive" : probe.status === null ? "text-text-subtle" : "text-negative"
                      }
                    >
                      {probe.status === null ? "loading" : probe.status === 0 ? "offline" : probe.status}
                    </span>
                  </div>
                </div>
                <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
                  {probe.data === null ? "Loading…" : JSON.stringify(probe.data, null, 2)}
                </pre>
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-text-secondary">
          <span>
            Validation Lab intentionally labels its first calibration as price-derived 3/5 rather than overstating
            full five-signal validation.
          </span>
          <span className="font-mono text-text-subtle">{updatedAt || "running checks…"}</span>
        </div>
      </div>
    </main>
  );
}
