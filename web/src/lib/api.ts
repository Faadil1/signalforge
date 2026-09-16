export const API_BASE = "/api/v1";

export type ErrorDetail = { code: string; message: string };

export type SubSignal = {
  name: string;
  value: number;
  confidence: number;
  available: boolean;
  reason: string;
};

export type SignalOk = {
  ok: true;
  token: string;
  price: number;
  score: number;
  confidence: number;
  recommendation: string;
  timestamp: string;
  available_signals: number;
  total_signals: number;
  coverage: number;
  actionability: "actionable" | "observe" | "insufficient_evidence";
  execution_authorized: false;
  data_mode: "live" | "live_partial" | "mock" | "historical_proxy" | "unknown";
  source_meta: {
    mode?: string;
    provider?: string;
    sources?: Record<string, string>;
    observed_at?: string;
  };
  sub_signals: SubSignal[];
};

export type SignalError = {
  ok: false;
  token: string;
  error: ErrorDetail;
};

export type SignalResponse = SignalOk | SignalError;
export type SignalCard = SignalOk | SignalError;
export type SignalsBatch = { signals: SignalCard[]; count: number };
export type MarketCards = { market_cards: SignalCard[] };

export type SignalMeta = {
  key: string;
  name: string;
  weight: number;
  description: string;
};

export type RecommendationThreshold = {
  recommendation: string;
  min_score: number;
  max_score: number;
};

export type SignalsMetaResponse = {
  signal_count: number;
  total_weight: number;
  signals: SignalMeta[];
  recommendation_thresholds: RecommendationThreshold[];
};

export type Ticker = {
  token: string;
  symbol: string;
  price: number;
  price_change_pct: number;
  high: number;
  low: number;
  volume: number;
  quote_volume: number;
  source: string;
  timestamp: string;
};

export type TickersResponse = {
  ok: boolean;
  source: string;
  fetched_at: string;
  tickers: Ticker[];
};

export type FreshnessState = {
  status: string;
  source_timestamp?: string | null;
  received_at?: string | null;
  age_seconds?: number | null;
  max_age_seconds?: number | null;
};

export type AdmissionEntry = {
  raw_source: string;
  provider: string;
  freshness_status: string;
  age_seconds?: number | null;
  max_age_seconds?: number | null;
  dependent_signals?: string[];
  admitted_signals?: string[];
  quality_admitted: boolean;
  decision_admitted: boolean;
  reason_code: string;
};

export type EvidenceLease = {
  status: string;
  evaluated_at?: string;
  valid_until?: string | null;
  remaining_seconds?: number | null;
  limiting_raw_source?: string | null;
  contributing_raw_sources?: string[];
  freshness_only: boolean;
  forecast_validity_guaranteed: false;
  execution_authorized: false;
};

export type DecisionReceipt = {
  version: string;
  algorithm: string;
  digest: string;
  bound_fields?: string[];
};

export type DecisionPacket = {
  ok: true;
  contract_version: string;
  policy_version: string;
  token: string;
  stance: string;
  score: number;
  confidence: number;
  coverage: number;
  actionability: "actionable" | "observe" | "insufficient_evidence";
  execution_authorized: false;
  horizon: string;
  regime: string;
  evidence: {
    supporting: Array<{ name: string; value: number; confidence?: number; reason?: string }>;
    contradicting: Array<{ name: string; value: number; confidence?: number; reason?: string }>;
    neutral: Array<{ name: string; value: number; confidence?: number; reason?: string }>;
  };
  data_quality: {
    mode?: string;
    provider?: string;
    sources?: Record<string, string>;
    freshness?: Record<string, FreshnessState>;
    quality_summary?: {
      healthy_sources?: string[];
      stale_sources?: string[];
      unavailable_sources?: string[];
      unknown_sources?: string[];
      inconsistent_sources?: string[];
      mock_sources?: string[];
    };
    observed_at?: string;
    fallback_active?: boolean;
    primary_provider?: string;
    fallback_provider?: string;
  };
  evidence_admission_ledger?: {
    policy: string;
    entries: AdmissionEntry[];
    admitted_raw_sources: string[];
    excluded_raw_sources: string[];
    admitted_count: number;
    excluded_count: number;
    execution_authorized: false;
  };
  evidence_lineage?: {
    available_signals?: string[];
    unique_live_providers?: string[];
    dominant_provider?: string | null;
    dominant_provider_signal_share?: number;
    concentration_level?: string;
    independence_claimed?: false;
  };
  evidence_lease?: EvidenceLease;
  recovery_requirements?: {
    current_actionability: string;
    coverage_gate: { current: number; minimum: number; met: boolean; gap: number };
    confidence_gate: { current: number; minimum: number; met: boolean; gap: number };
    missing_signals?: Array<{ signal: string; weight: number; reason: string }>;
    guaranteed_recovery: false;
  };
  invalidation?: string[];
  timestamp: string;
  agent_next_action?: {
    code: string;
    reason: string;
    safe_for_agent: boolean;
    execution_authorized: false;
  };
  snapshot_id: string;
  receipt?: DecisionReceipt;
};

export type RecoveryPlan = {
  ok: true;
  contract: string;
  contract_version: string;
  policy_version: string;
  token: string;
  decision_snapshot_id: string;
  status: string;
  execution_authorized: false;
  evidence_debt: {
    coverage: number;
    required_coverage: number;
    coverage_gap: number;
    confidence: number;
    required_confidence: number;
    confidence_gap: number;
    unavailable_signals: string[];
    minimum_additional_signals_for_coverage_only: number;
  };
  blocking_conditions: Array<{ code: string; observed?: number; required?: number; gap?: number }>;
  recovery_candidates: Array<{
    signal: string;
    policy_confidence_if_usable?: number;
    coverage_contribution?: number;
    source_requirements?: Array<{
      source: string;
      current_state?: string;
      required_state?: string;
      max_age_seconds?: number;
    }>;
    safe_action: string;
  }>;
  next_safe_action: string;
  re_evaluate_after: string;
  non_guarantees: string[];
  refusal_receipt_id: string;
};

export type StressResult = {
  ok: true;
  token: string;
  fragility_class: string;
  minimum_dropouts_to_refusal?: number | null;
  minimum_refusal_sets?: string[][];
  minimum_sufficient_evidence?: {
    baseline_policy_passes: boolean;
    minimum_signal_count?: number | null;
    minimum_sufficient_signal_sets?: string[][];
  };
  execution_authorized: false;
};

export async function fetchTickers(): Promise<Ticker[]> {
  try {
    const res = await fetch(`${API_BASE}/market/tickers`);
    if (!res.ok) return [];
    const data = await safeJson<TickersResponse>(res, { ok: false, source: "", fetched_at: "", tickers: [] });
    return data.tickers ?? [];
  } catch {
    return [];
  }
}

export async function fetchTicker(token: string): Promise<Ticker | null> {
  try {
    const res = await fetch(`${API_BASE}/market/tickers/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    return safeJson<Ticker>(res, {
      token,
      symbol: `${token}USDT`,
      price: 0,
      price_change_pct: 0,
      high: 0,
      low: 0,
      volume: 0,
      quote_volume: 0,
      source: "",
      timestamp: "",
    });
  } catch {
    return null;
  }
}

export function isSignalOk(signal: SignalResponse | SignalCard): signal is SignalOk {
  return signal.ok === true;
}

export function extractJson(text: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  const candidate = braceMatch ? braceMatch[0] : bracketMatch ? bracketMatch[0] : null;
  if (!candidate) return null;
  return candidate.replace(/```/g, "").trim();
}

export function safeParseJson<T>(text: unknown, fallback: T): T {
  if (text && typeof text === "object") return text as T;
  if (typeof text !== "string" || !text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    const cleaned = extractJson(text);
    if (cleaned !== null) {
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    return safeParseJson<T>(text, fallback);
  } catch {
    return fallback;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchApi<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function postApi<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteApi<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export async function fetchDecisionPacket(token = "BTC"): Promise<DecisionPacket | null> {
  try {
    const res = await fetch(`${API_BASE}/decision/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<DecisionPacket>;
  } catch {
    return null;
  }
}

export async function fetchRecoveryPlan(token = "BTC"): Promise<RecoveryPlan | null> {
  try {
    const res = await fetch(`${API_BASE}/decision/${encodeURIComponent(token)}/recovery-plan`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<RecoveryPlan>;
  } catch {
    return null;
  }
}

export async function fetchStressResult(token = "BTC"): Promise<StressResult | null> {
  try {
    const res = await fetch(`${API_BASE}/decision/${encodeURIComponent(token)}/stress`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<StressResult>;
  } catch {
    return null;
  }
}
