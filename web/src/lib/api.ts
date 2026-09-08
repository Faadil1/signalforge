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
  const data = await safeJson<Ticker>(res, {
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
  return data;
}

export function isSignalOk(signal: SignalResponse | SignalCard): signal is SignalOk {
  return signal.ok === true;
}

/**
 * Strip markdown/LLM fences (```json ... ```, leading prose) before parsing JSON.
 * Returns the cleaned string or null if nothing parseable remains.
 */
export function extractJson(text: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  // Extract the first {...} or [...] block, ignoring ```json fences and prose.
  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  const candidate = braceMatch ? braceMatch[0] : bracketMatch ? bracketMatch[0] : null;
  if (!candidate) return null;
  // Strip any trailing ``` fence tokens that slipped inside.
  return candidate.replace(/```/g, "").trim();
}

/**
 * Safe JSON parser with try/catch. If `text` is an object (e.g. already parsed),
 * it is returned as-is. Returns `fallback` if parsing completely fails.
 */
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

/**
 * Read a fetch Response body safely. Handles non-JSON bodies, empty bodies,
 * and markdown-fenced LLM responses. Returns `fallback` on any failure.
 */
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
