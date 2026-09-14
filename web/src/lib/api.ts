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
  recommendation: string | null;
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

export async function fetchTickers(): Promise<Ticker[]> {
  const res = await fetch(`${API_BASE}/market/tickers`);
  const data = await safeJson<TickersResponse>(res, { ok: false, source: "", fetched_at: "", tickers: [] });
  return data.tickers ?? [];
}

export async function fetchTicker(token: string): Promise<Ticker | null> {
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
