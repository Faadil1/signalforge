"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Filter,
  GitBranch,
  Clock3,
  ShieldCheck,
  FlaskConical,
  Ban,
  Blocks,
  Wrench,
  ScanSearch,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";
import type { DecisionPacket, RecoveryPlan, StressResult } from "@/lib/api";

type Stage = {
  id: string;
  index: string;
  label: string;
  short: string;
  color: string;
  icon: LucideIcon;
  copy: string;
  state: string;
  tone?: "refusal" | "debt" | "recovery";
};

function percent(value?: number) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export function LifecycleEngine({
  packet,
  recovery,
  stress,
}: {
  packet: DecisionPacket | null;
  recovery: RecoveryPlan | null;
  stress: StressResult | null;
}) {
  const stages = useMemo<Stage[]>(() => {
    const admitted = packet?.evidence_admission_ledger?.admitted_count ?? 0;
    const excluded = packet?.evidence_admission_ledger?.excluded_count ?? 0;
    const provider = packet?.evidence_lineage?.dominant_provider || "pending";
    const lease = packet?.evidence_lease?.remaining_seconds;
    const refusing = packet?.actionability === "insufficient_evidence";
    const debtSignals = recovery?.evidence_debt.unavailable_signals || [];

    return [
      { id: "source", index: "01", label: "Raw source", short: "SOURCE", color: "#3257FF", icon: Database, copy: "Public market observations enter without being trusted by default.", state: packet?.data_quality.provider || "awaiting packet" },
      { id: "admission", index: "02", label: "Admission", short: "ADMIT", color: "#00C9E8", icon: Filter, copy: "Quality policy admits usable inputs and leaves degraded inputs outside the decision.", state: `${admitted} admitted / ${excluded} excluded` },
      { id: "lineage", index: "03", label: "Lineage", short: "LINEAGE", color: "#00AFC8", icon: GitBranch, copy: "Signals remain visibly tied to their raw inputs and live providers.", state: `${provider} · ${packet?.evidence_lineage?.concentration_level || "pending"}` },
      { id: "lease", index: "04", label: "Evidence lease", short: "LEASE", color: "#C6F432", icon: Clock3, copy: "Freshness has an expiry. The lease never claims forecast validity.", state: lease == null ? "pending" : `${Math.max(0, Math.round(lease))}s remaining` },
      { id: "gate", index: "05", label: "Policy gate", short: "GATE", color: "#6E46FF", icon: ShieldCheck, copy: "Coverage and adjusted confidence decide whether a conclusion is allowed to exist.", state: `${percent(packet?.coverage)} coverage · ${percent(packet?.confidence)} confidence` },
      { id: "fragility", index: "06", label: "Fragility", short: "STRESS", color: "#9278FF", icon: FlaskConical, copy: "Observed evidence is removed in bounded counterfactuals to expose decision fragility.", state: stress?.fragility_class || "awaiting stress test" },
      { id: "refusal", index: "07", label: "Refusal", short: "REFUSE", color: "#FF4F73", icon: Ban, copy: "When policy fails, SignalForge refuses instead of manufacturing conviction.", state: refusing ? "REFUSED / FAIL CLOSED" : packet?.actionability || "pending", tone: "refusal" },
      { id: "debt", index: "08", label: "Evidence debt", short: "DEBT", color: "#FF8A1F", icon: Blocks, copy: "Missing evidence becomes an explicit debt rather than a hidden neutral value.", state: debtSignals.length ? debtSignals.join(" + ") : "no unavailable signal debt", tone: "debt" },
      { id: "recovery", index: "09", label: "Recovery plan", short: "REPAIR", color: "#E73DFF", icon: Wrench, copy: "The system names safe reacquisition candidates without promising actionability.", state: recovery?.next_safe_action || "only created after refusal", tone: "recovery" },
      { id: "verification", index: "10", label: "Verification", short: "VERIFY", color: "#A038FF", icon: ScanSearch, copy: "Fresh evidence is compared with the prior refusal state to prove whether repair actually occurred.", state: "observed state change only" },
      { id: "receipt", index: "11", label: "Receipt", short: "RECEIPT", color: "#171522", icon: Fingerprint, copy: "Material packet fields are bound to a SHA-256 integrity digest.", state: packet?.receipt?.digest ? `${packet.receipt.digest.slice(0, 10)}…${packet.receipt.digest.slice(-6)}` : "pending" },
    ];
  }, [packet, recovery, stress]);

  const [active, setActive] = useState("refusal");
  const selected = stages.find((stage) => stage.id === active) || stages[0];

  return (
    <div className="forge-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-white/55 px-5 py-4 md:px-6">
        <div>
          <p className="forge-eyebrow">Evidence lifecycle / live contract</p>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">Hover, focus or tap a stage. Every visual state maps to a real SignalForge contract or boundary.</p>
        </div>
        <div className="chip border-prism-coral/40 bg-prism-coral/10 font-mono text-[10px] uppercase tracking-[0.14em] text-prism-coral">
          execution authority / none
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="lifecycle-track">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const isActive = selected.id === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onMouseEnter={() => setActive(stage.id)}
                onFocus={() => setActive(stage.id)}
                onClick={() => setActive(stage.id)}
                className={`lifecycle-node text-left ${stage.tone === "refusal" ? "lifecycle-node-refusal" : stage.tone === "debt" ? "lifecycle-node-debt" : stage.tone === "recovery" ? "lifecycle-node-recovery" : ""}`}
                aria-pressed={isActive}
              >
                <motion.span
                  className="lifecycle-orb"
                  style={{ background: stage.color }}
                  animate={isActive ? { scale: 1.1, rotate: 0 } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {stage.index}
                </motion.span>
                <div className="mt-5 md:mt-4">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-text-subtle">{stage.short}</p>
                  <p className="mt-1 text-[13px] font-semibold leading-tight text-text">{stage.label}</p>
                  <p className="mt-2 line-clamp-2 font-mono text-[9px] leading-4 text-text-subtle">{stage.state}</p>
                </div>
                <Icon className="absolute right-3 top-4 h-4 w-4 opacity-35 md:hidden" style={{ color: stage.color }} />
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={selected.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="grid gap-4 border-t border-border/70 bg-white/82 p-5 md:grid-cols-[96px_1fr_auto] md:items-center md:p-6"
      >
        <div className="flex h-20 items-center justify-center border border-border/70 bg-white" style={{ boxShadow: `inset 8px 0 0 ${selected.color}` }}>
          <selected.icon className="h-7 w-7" style={{ color: selected.color }} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: selected.color }}>{selected.index} / {selected.short}</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.025em] text-text">{selected.copy}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-subtle">LIVE STATE / {selected.state}</p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">AVAILABLE ≠ ACTIONABLE</span>
      </motion.div>
    </div>
  );
}
