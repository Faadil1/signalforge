from __future__ import annotations

import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.alert import Alert, NotificationMethod
from models.signal import RawSignalBundle
from services.binance_client import binance
from services.signal_fusion import payload_from_bundle

router = APIRouter(tags=["alerts"])

_alerts: dict[str, Alert] = {}


class AlertCreate(BaseModel):
    token: str
    condition: str
    threshold: float
    notification: NotificationMethod = "webhook"
    webhook_url: str | None = None


class AlertEvaluate(BaseModel):
    token: str


def _serialize(a: Alert) -> dict:
    return {
        "id": a.id,
        "token": a.token,
        "condition": a.condition,
        "threshold": a.threshold,
        "status": a.status,
        "notification": a.notification,
        "webhook_url": a.webhook_url,
        "created_at": a.created_at,
        "last_triggered": a.last_triggered,
    }


@router.get("/alerts")
async def list_alerts():
    return {"alerts": [_serialize(a) for a in _alerts.values()], "count": len(_alerts)}


@router.post("/alerts")
async def create_alert(body: AlertCreate):
    if body.condition not in ("gte", "lte"):
        raise HTTPException(status_code=422, detail="condition must be 'gte' or 'lte'")
    alert_id = str(uuid.uuid4())[:8]
    alert = Alert(
        id=alert_id,
        token=body.token.upper(),
        condition=body.condition,
        threshold=body.threshold,
        status="active",
        notification=body.notification,
        webhook_url=body.webhook_url,
        created_at=datetime.now(UTC).isoformat(),
    )
    _alerts[alert_id] = alert
    return _serialize(alert)


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    if alert_id not in _alerts:
        raise HTTPException(status_code=404, detail="Alert not found")
    del _alerts[alert_id]
    return {"status": "deleted"}


@router.post("/alerts/evaluate")
async def evaluate_alerts(body: AlertEvaluate):
    """Check active alerts for a token against the live composite signal and fire webhooks."""
    sources = await binance.fetch_signal_sources(body.token.upper())
    bundle = RawSignalBundle(**sources)
    composite = payload_from_bundle(bundle)

    fired = []
    for a in _alerts.values():
        if a.status != "active" or a.token.upper() != composite["token"]:
            continue
        hit = (
            composite["score"] >= a.threshold
            if a.condition == "gte"
            else composite["score"] <= a.threshold
            if a.condition == "lte"
            else False
        )
        if hit:
            a.status = "triggered"
            a.last_triggered = composite["timestamp"]
            await _fire_webhook(a, composite)
            fired.append(_serialize(a))

    return {"evaluated": composite["token"], "score": composite["score"], "fired": fired}


async def _fire_webhook(alert: Alert, payload: dict) -> None:
    if alert.notification in ("webhook", "both") and alert.webhook_url:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    alert.webhook_url,
                    json={
                        "event": "signal_alert",
                        "alert_id": alert.id,
                        "token": alert.token,
                        "condition": alert.condition,
                        "threshold": alert.threshold,
                        "payload": payload,
                    },
                )
        except Exception:
            # Webhook delivery failure should not break the alert evaluation.
            pass
