from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

AlertStatus = Literal["active", "triggered", "expired"]
NotificationMethod = Literal["webhook"]


@dataclass
class Alert:
    id: str
    token: str
    condition: str  # gte | lte
    threshold: float
    status: AlertStatus
    notification: NotificationMethod
    created_at: str
    webhook_url: str | None = None
    last_triggered: str | None = None


@dataclass
class AlertHistory:
    alert_id: str
    triggered_at: str
    signal_score: float
    token_price: float
    outcome: str
