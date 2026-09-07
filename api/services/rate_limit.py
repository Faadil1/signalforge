from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from services.config import get_settings
from services.errors import RATE_LIMITED


class RateLimiter:
    """Sliding-window rate limiter per named tier."""

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    def _check(self, key: str, limit: int, window_s: float = 60.0) -> None:
        now = time.monotonic()
        window = self._windows[key]
        while window and window[0] <= now - window_s:
            window.popleft()
        if len(window) >= limit:
            retry_after = int(window[0] + window_s - now) + 1
            raise HTTPException(
                status_code=429,
                detail={
                    "ok": False,
                    "error": {
                        "code": RATE_LIMITED,
                        "message": f"Rate limit exceeded for {key}. Retry after {retry_after}s.",
                    },
                },
                headers={"Retry-After": str(retry_after)},
            )
        window.append(now)

    def clear(self) -> None:
        """Drop all recorded requests (used between test scenarios)."""
        self._windows.clear()


_limiter = RateLimiter()

_LIMIT_MAP = {
    "general": lambda s: s.rate_limit_general,
    "signal": lambda s: s.rate_limit_signal,
    "overview": lambda s: s.rate_limit_overview,
    "backtest": lambda s: s.rate_limit_backtest,
    "alert": lambda s: s.rate_limit_alert,
}


async def rate_limit(request: Request, tier: str = "general") -> None:
    """FastAPI dependency. Skips entirely when RATE_LIMIT_ENABLED=false."""
    settings = getattr(request.app.state, "settings", None) or get_settings()
    if not settings.rate_limit_enabled:
        return
    getter = _LIMIT_MAP.get(tier)
    if getter is None:
        return
    limit = getter(settings)
    client_ip = request.client.host if request.client else "unknown"
    _limiter._check(f"{tier}:{client_ip}", limit)
