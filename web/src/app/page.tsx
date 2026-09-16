"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Asterisk,
  Ban,
  Braces,
  CheckCircle2,
  CircleDashed,
  Fingerprint,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import {
  fetchDecisionPacket,
  fetchRecoveryPlan,
  fetchStressResult,
  fetchTicker,
  type DecisionPacket,
  type RecoveryPlan,
  type StressResult,
  type Ticker,
} from "@/lib/api";
import { useInterval } from "@/lib/useInterval";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { LifecycleEngine } from "@/components/forge/LifecycleEngine";
import { DecisionGate } from "@/components/forge/DecisionGate";
import { EvidenceLease } from "@/components/forge/EvidenceLease";
import { EvidenceDebt } from "@/components/forge/EvidenceDebt";
import { ReceiptStrip } from "@/components/forge/ReceiptStrip";

const POLL_MS = 15_000;

function compactPrice(value?: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function ago(timestamp?: string) {
  if (!timestamp) return "awaiting packet";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 5) return "observed now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function LandingPage() {
  const [packet, setPacket] = useState<DecisionPacket | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPlan | null>(null);
  const [stress, setStress] = useState<StressResult | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setNow] = useState(Date.now());

  useInterval(() => setNow(Date.now()), 1000);

  const load = useCallback(async () => {
    const [nextPacket, nextRecovery, nextStress, nextTicker] = await Promise.all([
      fetchDecisionPacket("BTC"),
      fetchRecoveryPlan("BTC"),
      fetchStressResult("BTC"),
      fetchTicker("BTC"),
    ]);
    setPacket(nextPacket);
    setRecovery(nextRecovery);
    setStress(nextStress);
    setTicker(nextTicker);
    setError(nextPacket ? null : "Live Decision Packet unavailable.");
  }, []);

  useEffect(() => { void load(); }, [load]);
  useInterval(load, POLL_MS);

  const refused = packet?.actionability === "insufficient_evidence";
  const admitted = packet?.evidence_admission_ledger?.admitted_count ?? 0;
  const excluded = packet?.evidence_admission_ledger?.excluded_count ?? 0;
  const unavailable = recovery?.evidence_debt.unavailable_signals || [];
  const confidenceGap = recovery?.evidence_debt.confidence_gap ?? 0;

  return (
    <div className="forge-shell text-text">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-[#eef3ff]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1600px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle md:inline">PRISMATIC EVIDENCE FOUNDRY / TRACE V2</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/judge" className="hidden sm:block"><Button variant="ghost">Proof chain</Button></Link>
            <Link href="/dashboard"><Button>Enter foundry <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
        <div className="prism-rule" />
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="mx-auto grid max-w-[1600px] gap-8 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-12 lg:items-end lg:py-24">
            <motion.div className="lg:col-span-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .36 }}>
              <p className="forge-eyebrow">SignalForge / pre-action evidence gate</p>
              <h1 className="forge-display mt-7 max-w-[1100px] text-[clamp(4.3rem,10vw,10rem)] font-semibold text-prism-ink">
                Prove the right<br />to conclude.
              </h1>
              <div className="mt-8 grid max-w-4xl gap-5 border-l-4 border-prism-coral pl-5 md:grid-cols-[1.2fr_.8fr] md:items-end md:pl-7">
                <p className="text-lg leading-8 text-text-secondary md:text-xl">Raw market data is not a decision. SignalForge exposes the full evidence lifecycle — admission, lineage, expiry, fragility, refusal, debt, recovery and receipt — before an agent can trust a conclusion.</p>
                <p className="font-mono text-[10px] uppercase leading-5 tracking-[0.15em] text-text-subtle">Evidence before recommendation.<br />Refusal before false confidence.<br />Recovery before retry.</p>
              </div>
            </motion.div>

            <motion.div className="lg:col-span-4" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .36, delay: .08 }}>
              <div className="forge-panel forge-cut p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-text-subtle">LIVE / BTC</span>
                  <span className={`chip font-mono text-[8px] uppercase tracking-[0.14em] ${refused ? "border-prism-coral/40 bg-prism-coral/10 text-prism-coral" : "border-prism-cyan/40 bg-prism-cyan/10 text-prism-ink"}`}>{packet?.actionability || "loading"}</span>
                </div>
                <div className="mt-7 flex items-end justify-between gap-4">
                  <div><p className="atlas-micro">market context</p><p className="mt-1 font-mono text-4xl font-semibold tracking-[-0.05em] text-text">${compactPrice(ticker?.price)}</p></div>
                  <div className="text-right"><p className="atlas-micro">composite</p><p className="mt-1 font-mono text-6xl font-semibold tracking-[-0.07em] text-text">{packet ? packet.score.toFixed(1) : "—"}</p></div>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
                  <div className="bg-white/82 p-3"><p className="atlas-micro">coverage</p><p className="mt-1 font-mono text-2xl font-semibold">{packet ? `${Math.round(packet.coverage * 100)}%` : "—"}</p></div>
                  <div className="bg-white/82 p-3"><p className="atlas-micro">confidence</p><p className="mt-1 font-mono text-2xl font-semibold text-prism-coral">{packet ? `${Math.round(packet.confidence * 100)}%` : "—"}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-text-subtle">{ago(packet?.timestamp)}</span>
                  <span className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-prism-coral"><ShieldOff className="h-4 w-4" /> authority / none</span>
                </div>
                {error && <p className="mt-3 font-mono text-[9px] text-prism-coral">{error}</p>}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <LifecycleEngine packet={packet} recovery={recovery} stress={stress} />
        </section>

        <section className="mx-auto grid max-w-[1600px] gap-7 px-5 py-10 md:px-8 md:py-16 lg:grid-cols-[.35fr_.65fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="forge-eyebrow">The moment that matters</p>
            <h2 className="forge-display mt-6 text-5xl font-semibold text-text md:text-7xl">Refusal is a product state, not an error.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-text-secondary">Most market interfaces keep optimizing for an answer. SignalForge makes the absence of sufficient evidence impossible to hide.</p>
            <div className="mt-8 space-y-3">
              {[
                ["admitted raw sources", `${admitted}`],
                ["excluded raw sources", `${excluded}`],
                ["confidence debt", `${Math.round(confidenceGap * 100)} pts`],
                ["unavailable", unavailable.join(" + ") || "none"],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-border/70 py-3"><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-subtle">{label}</span><span className="font-mono text-[11px] font-semibold text-text">{value}</span></div>)}
            </div>
          </div>
          <DecisionGate packet={packet} />
        </section>

        <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <EvidenceLease packet={packet} />
        </section>

        <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <EvidenceDebt recovery={recovery} />
        </section>

        <section className="mx-auto grid max-w-[1600px] gap-5 px-5 py-12 md:px-8 md:py-20 lg:grid-cols-3">
          {[
            { icon: Ban, code: "FAIL CLOSED", color: "#FF4F73", title: "No synthetic completeness.", copy: "Unavailable funding and open-interest evidence stays unavailable. A missing channel never becomes a neutral-looking number." },
            { icon: CircleDashed, code: "OBSERVED REPAIR", color: "#E73DFF", title: "Recovery is measurable.", copy: "A recovery plan can be checked against fresh live evidence. Improvement is observed, not assumed." },
            { icon: Fingerprint, code: "INTEGRITY", color: "#171522", title: "The packet can be verified.", copy: "Receipts bind material decision fields without pretending to be a signature, oracle or external truth proof." },
          ].map((item, index) => (
            <motion.div key={item.code} whileHover={{ y: -5 }} transition={{ duration: .16 }} className="forge-panel p-6 md:p-7" style={{ boxShadow: `inset 0 7px 0 ${item.color}, 0 22px 60px rgba(50,87,255,.08)` }}>
              <div className="flex items-center justify-between"><item.icon className="h-6 w-6" style={{ color: item.color }} /><span className="font-mono text-[9px] text-text-subtle">0{index + 1}</span></div>
              <p className="mt-8 font-mono text-[9px] font-semibold uppercase tracking-[0.17em]" style={{ color: item.color }}>{item.code}</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-text">{item.title}</h3>
              <p className="mt-4 text-sm leading-6 text-text-secondary">{item.copy}</p>
            </motion.div>
          ))}
        </section>

        <section className="mx-auto max-w-[1600px] px-5 pb-12 md:px-8 md:pb-20">
          <ReceiptStrip packet={packet} recovery={recovery} />
        </section>

        <section className="border-y border-border bg-prism-violet text-white">
          <div className="mx-auto grid max-w-[1600px] gap-8 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-prism-lime"><Sparkles className="h-4 w-4" /> LIVE PROOF SURFACE</div>
              <p className="forge-display mt-5 max-w-5xl text-5xl font-semibold md:text-8xl">Don&apos;t trust the page. Probe the system.</p>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-white/75">The judge surface calls the runtime directly: exact commit, Decision Packet, stress, refusal/recovery, integrity and MCP.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/judge"><Button size="lg" variant="secondary">Open proof chain <CheckCircle2 className="h-4 w-4" /></Button></Link>
              <Link href="/playground"><Button size="lg" variant="secondary">Agent interface <Braces className="h-4 w-4" /></Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[10px] text-text-subtle md:px-8">
        <span className="font-mono uppercase tracking-[0.15em]">SignalForge / evidence before recommendation</span>
        <span className="flex items-center gap-2 font-mono uppercase tracking-[0.15em]"><Asterisk className="h-3.5 w-3.5 text-prism-lime" /> AVAILABLE ≠ FRESH ≠ CONSISTENT ≠ ACTIONABLE</span>
      </footer>
    </div>
  );
}
