"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, BellRing, Webhook, KeyRound, Zap } from "lucide-react";
import { safeJson } from "@/lib/api";
import { ENABLE_ALERTS } from "@/lib/features";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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

const STATUS_TONE = {
  active: "positive",
  triggered: "warning",
  expired: "neutral",
} as const;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evalResult, setEvalResult] = useState<{ token: string; score: number; fired: number } | null>(null);
  const [newAlert, setNewAlert] = useState({
    token: "",
    condition: "gte",
    threshold: 70,
    notification: "webhook",
    webhook_url: "",
  });

  const load = useCallback(async () => {
    if (!ENABLE_ALERTS) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alerts");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await safeJson<{ alerts: Alert[] }>(res, { alerts: [] });
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

  if (!ENABLE_ALERTS) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Alerts" subtitle="Signal-triggered webhooks evaluated against live composite scores" />
        <Card className="p-8 text-center">
          <p className="mb-2 text-sm font-medium text-brand">Experimental feature — disabled</p>
          <p className="text-xs text-text-secondary">
            Alerts are disabled in this deployment. Enable them by setting{" "}
            <span className="font-mono text-text">ENABLE_ALERTS=true</span> on the API and{" "}
            <span className="font-mono text-text">NEXT_PUBLIC_ENABLE_ALERTS=true</span> on the web build.
          </p>
        </Card>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newAlert.token || !newAlert.webhook_url || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: newAlert.token.toUpperCase(),
          condition: newAlert.condition,
          threshold: newAlert.threshold,
          notification: "webhook",
          webhook_url: newAlert.webhook_url,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.detail?.error?.message || `API error: ${res.status}`;
        throw new Error(code);
      }
      await load();
      setNewAlert({ token: "", condition: "gte", threshold: 70, notification: "webhook", webhook_url: "" });
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create alert");
    } finally {
      setSubmitting(false);
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
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.detail?.error?.message || `API error: ${res.status}`;
        throw new Error(msg);
      }
      const data = await safeJson<{ evaluated: string; score: number; fired: { id: string }[] }>(res, { evaluated: "BTC", score: 0, fired: [] });
      setEvalResult({ token: data.evaluated, score: data.score, fired: data.fired.length });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Alerts"
        subtitle="Signal-triggered webhooks evaluated against live composite scores"
        badge={<Badge tone="info"><BellRing className="h-3.5 w-3.5" /> Webhooks</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button size="md" variant="secondary" onClick={handleEvaluate}>
              <Zap className="h-4 w-4" /> Evaluate vs Live BTC
            </Button>
            <Button size="md" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" /> New Alert
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="flex items-center justify-between p-4 text-sm text-negative font-mono">
          <span>{error}</span>
          <button onClick={load} className="underline text-brand">retry</button>
        </Card>
      )}

      {evalResult && (
        <Card className="flex items-center justify-between p-4 text-xs font-mono">
          <span className="text-text-secondary">
            Evaluated {evalResult.token} against live signal: score <span className="font-semibold text-brand">{evalResult.score}</span> —{" "}
            {evalResult.fired} alert{evalResult.fired === 1 ? "" : "s"} fired
          </span>
          <button onClick={() => setEvalResult(null)} className="text-text-subtle hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create Alert</CardTitle></CardHeader>
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Token</label>
                <input
                  type="text"
                  placeholder="e.g. BTC"
                  value={newAlert.token}
                  maxLength={10}
                  onChange={(e) => setNewAlert({ ...newAlert, token: e.target.value.toUpperCase() })}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Condition</label>
                <select
                  value={newAlert.condition}
                  onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                  className="input"
                >
                  <option value="gte">score &gt;=</option>
                  <option value="lte">score &lt;=</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Threshold</label>
                <input
                  type="number"
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert({ ...newAlert, threshold: Number(e.target.value) })}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Notification</label>
                <select value="webhook" disabled className="input disabled:opacity-60">
                  <option value="webhook">webhook</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-text-subtle">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://…"
                  value={newAlert.webhook_url}
                  onChange={(e) => setNewAlert({ ...newAlert, webhook_url: e.target.value })}
                  className="input font-mono"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="md" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="md" onClick={handleCreate} loading={submitting} disabled={!newAlert.token || !newAlert.webhook_url}>
                {!submitting && <Webhook className="h-4 w-4" />} {submitting ? "Creating…" : "Create Alert"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="p-8 text-center text-xs text-text-subtle animate-pulse">Loading alerts…</div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] uppercase tracking-wider text-text-subtle">
              <div className="col-span-2">Token</div>
              <div className="col-span-2">Condition</div>
              <div className="col-span-1">Threshold</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Notification</div>
              <div className="col-span-2">Last Triggered</div>
              <div className="col-span-1" />
            </div>
            {alerts.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-text-subtle">No alerts yet — create one to get webhook-triggered signal alerts.</div>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="grid grid-cols-12 items-center gap-2 px-5 py-3 text-sm hover:bg-surface-secondary/60 transition-colors">
                <div className="col-span-2 font-mono font-medium text-text">{a.token}</div>
                <div className="col-span-2 font-mono text-xs text-text-secondary">{a.condition === "gte" ? "score >=" : "score <="}</div>
                <div className="col-span-1 font-mono text-xs text-text">{a.threshold}</div>
                <div className="col-span-2">
                  <Badge tone={STATUS_TONE[a.status] || "neutral"} className="capitalize">{a.status}</Badge>
                </div>
                <div className="col-span-2 text-xs text-text-secondary capitalize">
                  <span className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-text-subtle" /> {a.notification}</span>
                </div>
                <div className="col-span-2 truncate font-mono text-xs text-text-subtle">
                  {a.last_triggered ? new Date(a.last_triggered).toISOString().slice(0, 16) : "—"}
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-text-subtle hover:text-negative transition-colors">
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}