import { ShieldAlert, ShieldCheck, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionabilityGateProps = {
  actionability?: string;
  coverage?: number;
  confidence?: number;
  executionAuthorized?: boolean;
  className?: string;
};

export function ActionabilityGate({
  actionability = "insufficient_evidence",
  coverage = 0,
  confidence = 0,
  executionAuthorized = false,
  className,
}: ActionabilityGateProps) {
  const actionable = actionability === "actionable";
  const observe = actionability === "observe";
  const status = actionable ? "actionable" : observe ? "observe" : "refused";
  const Icon = actionable ? ShieldCheck : observe ? ShieldAlert : Ban;

  return (
    <div className={cn("action-gate", `action-gate-${status}`, className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="action-gate-icon"><Icon className="h-4 w-4" /></div>
          <div>
            <p className="atlas-kicker">ACTIONABILITY GATE</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-text">{actionability.replaceAll("_", " ")}</p>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-text-secondary">
              Decision output is bounded by evidence coverage and confidence. Execution authority is a separate control plane.
            </p>
          </div>
        </div>
        <span className={cn("atlas-stamp", executionAuthorized ? "atlas-stamp-live" : "atlas-stamp-refused")}>
          {executionAuthorized ? "EXECUTION ALLOWED" : "EXECUTION UNAUTHORIZED"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-surface/80 p-3">
          <p className="atlas-micro">coverage</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-text">{Math.round(coverage * 100)}%</p>
        </div>
        <div className="bg-surface/80 p-3">
          <p className="atlas-micro">confidence</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-text">{Math.round(confidence * 100)}%</p>
        </div>
        <div className="col-span-2 bg-surface/80 p-3 sm:col-span-1">
          <p className="atlas-micro">authority</p>
          <p className="mt-1 font-mono text-[12px] font-semibold uppercase tracking-wide text-text">{executionAuthorized ? "granted" : "none"}</p>
        </div>
      </div>
    </div>
  );
}
