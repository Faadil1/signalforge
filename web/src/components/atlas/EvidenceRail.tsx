import { cn } from "@/lib/utils";

type EvidenceRailProps = {
  sources?: Record<string, string>;
  coverage?: number;
  compact?: boolean;
  className?: string;
};

const LABEL: Record<string, string> = {
  technical: "TECH",
  trend: "TREND",
  volume: "VOL",
  klines: "KLINES",
  ticker: "TICKER",
  funding: "FUND",
  open_interest: "OI",
};

function state(source: string) {
  if (!source || source === "unavailable") return "excluded";
  if (source === "mock") return "mock";
  if (source === "stale" || source === "unknown" || source === "inconsistent") return "degraded";
  return "live";
}

function sourceLabel(source: string) {
  if (source === "coinbase_exchange") return "COINBASE";
  if (source === "binance_futures") return "BINANCE F";
  if (source === "binance_spot") return "BINANCE S";
  if (source === "binance_public") return "BINANCE";
  if (source === "unavailable") return "EXCLUDED";
  return source ? source.replaceAll("_", " ").toUpperCase() : "UNKNOWN";
}

export function EvidenceRail({ sources = {}, coverage, compact = false, className }: EvidenceRailProps) {
  const entries = Object.entries(sources);

  return (
    <div className={cn("evidence-rail", compact && "evidence-rail-compact", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2">
        <div>
          <p className="atlas-kicker">SOURCE HEALTH RAIL</p>
          <p className="mt-1 text-[11px] text-text-subtle">Observed provider state · unavailable evidence stays excluded</p>
        </div>
        {coverage != null && (
          <div className="text-right">
            <p className="font-mono text-lg font-semibold tabular-nums text-text">{Math.round(coverage * 100)}%</p>
            <p className="atlas-micro">coverage</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {entries.length ? entries.map(([name, source]) => {
          const sourceState = state(source);
          return (
            <div key={name} className={cn("evidence-node", `evidence-node-${sourceState}`)}>
              <div className="flex items-center justify-between gap-2">
                <span className="atlas-micro text-text-secondary">{LABEL[name] || name.replaceAll("_", " ").toUpperCase()}</span>
                <span className={cn("evidence-dot", `evidence-dot-${sourceState}`)} />
              </div>
              <p className="mt-2 truncate font-mono text-[11px] font-medium text-text">{sourceLabel(source)}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-text-subtle">{sourceState}</p>
            </div>
          );
        }) : (
          <div className="col-span-full border border-dashed border-border px-3 py-4 text-[11px] text-text-subtle">Source provenance not loaded yet.</div>
        )}
      </div>
    </div>
  );
}
