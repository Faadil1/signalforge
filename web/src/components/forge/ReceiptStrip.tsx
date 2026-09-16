"use client";

import { Fingerprint, LockKeyhole, ShieldOff } from "lucide-react";
import type { DecisionPacket, RecoveryPlan } from "@/lib/api";

function compact(value?: string) {
  if (!value) return "pending";
  if (value.length < 24) return value;
  return `${value.slice(0, 12)}…${value.slice(-10)}`;
}

export function ReceiptStrip({ packet, recovery }: { packet: DecisionPacket | null; recovery: RecoveryPlan | null }) {
  return (
    <section className="receipt-strip grid gap-5 p-5 md:grid-cols-[1.2fr_.8fr] md:items-end md:p-7">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Fingerprint className="h-5 w-5 text-prism-lime" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-prism-lime">11 / RECEIPT</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#aaa5c2]">integrity digest / not a signature</span>
        </div>
        <p className="mt-5 max-w-3xl text-3xl font-semibold leading-[1] tracking-[-0.045em] text-white md:text-5xl">The state closes with an inspectable receipt.</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c8c4d8]">Material Decision Packet fields are bound to SHA-256. This proves packet integrity only — never market truth, identity or execution authority.</p>
      </div>

      <div className="space-y-3 border-t border-white/15 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div><p className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#827c9b]">decision snapshot</p><p className="mt-1 break-all font-mono text-[11px] text-white">{packet?.snapshot_id || "pending"}</p></div>
        <div><p className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#827c9b]">sha-256 digest</p><p className="mt-1 break-all font-mono text-[11px] text-prism-cyan">{compact(packet?.receipt?.digest)}</p></div>
        <div><p className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#827c9b]">refusal receipt</p><p className="mt-1 break-all font-mono text-[11px] text-prism-orange">{compact(recovery?.refusal_receipt_id)}</p></div>
        <div className="flex items-center gap-2 pt-2 text-prism-coral"><ShieldOff className="h-4 w-4" /><LockKeyhole className="h-4 w-4" /><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">execution_authorized:false</span></div>
      </div>
    </section>
  );
}
