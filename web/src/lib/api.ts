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

export function isSignalOk(signal: SignalResponse | SignalCard): signal is SignalOk {
  return signal.ok === true;
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