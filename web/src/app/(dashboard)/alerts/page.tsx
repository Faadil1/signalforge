"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";

type Alert = {
  id: string;
  token: string;
  condition: string;
  threshold: number;
  status: "active" | "triggered" | "expired";
  notification: string;
  webhook_url: string | null;
  created_at: string;
  last_triggered: string | null;
};

const STATUS_STYLE = {
  active: "bg-sf-accent/15 text-sf-accent",
  triggered: "bg-orange-500/15 text-orange-400",
  expired: "bg-sf-muted/15 text-sf-muted",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [evalResult, setEvalResult] = useState<{ token: string; score: number; fired: number } | null>(null);
  const [newAlert, setNewAlert] = useState({
    token: "",
    condition: "gte",
    threshold: 70,
    notification: "webhook",
    webhook_url: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alerts");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newAlert.token) return;
    setError(null);
    try {
      const res = await fetch("/api/v1/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: newAlert.token.toUpperCase(),
          condition: newAlert.condition,
          threshold: newAlert.threshold,
          notification: newAlert.notification,
          webhook_url: newAlert.webhook_url || null,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await load();
      setNewAlert({ token: "", condition: "gte", threshold: 70, notification: "webhook", webhook_url: "" });
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create alert");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/alerts/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete alert");
    }
  };

  const handleEvaluate = async () => {
    setError(null);
    setEvalResult(null);
    try {
      const res = await fetch("/api/v1/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "BTC" }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setEvalResult({ token: data.evaluated, score: data.score, fired: data.fired.length });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Alerts</h1>
          <p className="text-sm text-sf-muted">Signal-triggered webhooks evaluated against live composite scores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluate}
            className="text-xs px-3 py-1.5 rounded border border-sf-border hover:border-sf-accent transition-colors"
          >
            Evaluate vs Live BTC
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-sf-accent text-sf-bg text-xs font-medium px-3 py-1.5 rounded hover:bg-sf-accent/90 transition-colors"
          >
            + New Alert
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-3 text-xs text-sf-danger font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline text-sf-accent">retry</button>
        </div>
      )}

      {evalResult && (
        <div className="card p-3 text-xs font-mono flex items-center justify-between">
          <span className="text-sf-muted">
            Evaluated BTC against live signal: score <span className="text-sf-accent">{evalResult.score}</span> — {evalResult.fired} alert{evalResult.fired === 1 ? "" : "s"} fired
          </span>
          <button onClick={() => setEvalResult(null)} className="text-sf-muted hover:text-sf-text">✕</button>
        </div>
      )}

      {showCreate && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3">Create Alert</h3>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Token</label>
              <input
                type="text"
                placeholder="e.g. BTC"
                value={newAlert.token}
                onChange={(e) => setNewAlert({ ...newAlert, token: e.target.value.toUpperCase() })}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sf-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Condition</label>
              <select
                value={newAlert.condition}
                onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sf-accent"
              >
                <option value="gte">score &gt;=</option>
                <option value="lte">score &lt;=</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Threshold</label>
              <input
                type="number"
                value={newAlert.threshold}
                onChange={(e) => setNewAlert({ ...newAlert, threshold: Number(e.target.value) })}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sf-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Notification</label>
              <select
                value={newAlert.notification}
                onChange={(e) => setNewAlert({ ...newAlert, notification: e.target.value })}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sf-accent"
              >
                <option value="webhook">webhook</option>
                <option value="email">email</option>
                <option value="both">both</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-sf-muted uppercase tracking-wider block mb-1">Webhook URL</label>
              <input
                type="text"
                placeholder="https://…"
                value={newAlert.webhook_url}
                onChange={(e) => setNewAlert({ ...newAlert, webhook_url: e.target.value })}
                className="w-full bg-sf-bg border border-sf-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sf-accent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="text-xs text-sf-muted px-3 py-1.5 rounded border border-sf-border hover:border-sf-accent transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} className="bg-sf-accent text-sf-bg text-xs font-medium px-3 py-1.5 rounded hover:bg-sf-accent/90 transition-colors">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-xs text-sf-muted animate-pulse">Loading alerts…</div>
        ) : (
          <div className="divide-y divide-sf-border">
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-sf-muted uppercase tracking-wider">
              <div className="col-span-2">Token</div>
              <div className="col-span-2">Condition</div>
              <div className="col-span-1">Threshold</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Notification</div>
              <div className="col-span-2">Last Triggered</div>
              <div className="col-span-1" />
            </div>
            {alerts.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-sf-muted">No alerts yet — create one to get webhook-triggered signal alerts.</div>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm hover:bg-sf-bg/50 transition-colors">
                <div className="col-span-2 font-mono font-medium">{a.token}</div>
                <div className="col-span-2 font-mono text-xs text-sf-muted">{a.condition === "gte" ? "score >=" : "score <="}</div>
                <div className="col-span-1 font-mono text-xs">{a.threshold}</div>
                <div className="col-span-2">
                  <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize", STATUS_STYLE[a.status] || STATUS_STYLE.active)}>
                    {a.status}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-sf-muted capitalize">{a.notification}</div>
                <div className="col-span-2 text-xs text-sf-muted font-mono truncate">{a.last_triggered ? new Date(a.last_triggered).toISOString().slice(0, 16) : "—"}</div>
                <div className="col-span-1 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-[10px] text-sf-muted hover:text-sf-danger transition-colors">
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}