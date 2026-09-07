from __future__ import annotations

from typing import Any

INVALID_TOKEN = "INVALID_TOKEN"
TOO_MANY_TOKENS = "TOO_MANY_TOKENS"
INVALID_PERIOD = "INVALID_PERIOD"
SIGNAL_FETCH_FAILED = "SIGNAL_FETCH_FAILED"
INTERNAL_ERROR = "INTERNAL_ERROR"
RATE_LIMITED = "RATE_LIMITED"
INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


def error_token_payload(token: str, code: str, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "token": token.upper(),
        "error": {"code": code, "message": message},
    }
