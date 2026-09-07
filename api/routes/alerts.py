from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from models.alert import Alert, NotificationMethod
from services.errors import INVALID_TOKEN, error_token_payload
from services.rate_limit import rate_limit
from services.signal_service import get_signal_payload
from services.symbols import is_valid_token, normalize_token
from services.webhook_safety import fire_webhook, validate_webhook_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["alerts"])

_alerts: dict[str, Alert] = {}


def _clear_alerts() -> None:
    """Drop all in-memory alerts (used between test scenarios)."""
    _alerts.clear()


AlertCondition = Literal["gte", "lte"]


async def _alert_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="alert")


class AlertCreate(BaseModel):
    token: str
    condition: AlertCondition = "gte"
    threshold: float = Field(ge=0, le=100)
    notification: NotificationMethod = "webhook"
    webhook_url: str


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


@router.post("/alerts", dependencies=[Depends(_alert_rate_limited)])
async def create_alert(body: AlertCreate):
    symbol = normalize_token(body.token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)

    validate_webhook_url(body.webhook_url)

    alert_id = str(uuid.uuid4())[:8]
    alert = Alert(
        id=alert_id,
        token=symbol,
        condition=body.condition,
        threshold=body.threshold,
        status="active",
        notification="webhook",
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


@router.post("/alerts/evaluate", dependencies=[Depends(_alert_rate_limited)])
async def evaluate_alerts(body: AlertEvaluate):
    """Check active alerts for a token against the live composite signal and fire webhooks."""
    symbol = normalize_token(body.token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)

    composite = await get_signal_payload(symbol)
    if not composite["ok"]:
        raise HTTPException(status_code=502, detail=composite)

    fired = []
    for a in _alerts.values():
        if a.status != "active" or a.token != composite["token"]:
            continue
        hit = (
            composite["score"] >= a.threshold
            if a.condition == "gte"
            else composite["score"] <= a.threshold
            if a.condition == "lte"
            else False
        )
        if hit:
            try:
                await _fire_webhook(a, composite)
            except Exception as exc:
                logger.warning("Webhook delivery failed for alert %s: %s", a.id, exc)
                continue
            a.status = "triggered"
            a.last_triggered = composite["timestamp"]
            fired.append(_serialize(a))

    return {"evaluated": composite["token"], "score": composite["score"], "fired": fired}


async def _fire_webhook(alert: Alert, payload: dict) -> None:
    if alert.webhook_url:
        await fire_webhook(
            alert.webhook_url,
            {
                "event": "signal_alert",
                "alert_id": alert.id,
                "token": alert.token,
                "condition": alert.condition,
                "threshold": alert.threshold,
                "payload": payload,
            },
        )
