from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.config import Settings


@pytest.fixture(autouse=True)
def _reset_global_state():
    """Clear module-level singletons so scenarios never leak into each other.

    The cache, rate-limiter, and in-memory alert store are process-wide globals
    shared across every app instance created this way.
    """
    from routes.alerts import _clear_alerts
    from services.cache import get_cache
    from services.config import get_settings
    from services.rate_limit import _limiter

    get_cache().clear()
    _limiter.clear()
    _clear_alerts()
    get_settings(reload=True)
    yield
    get_cache().clear()
    _limiter.clear()
    _clear_alerts()
    get_settings(reload=True)


def build_settings(**overrides) -> Settings:
    """Settings with alerts/backtests enabled and rate limiting off by default."""
    base = Settings(rate_limit_enabled=False, enable_alerts=True, enable_backtests=True)
    return Settings(**{**base.__dict__, **overrides})


def make_client(**overrides) -> TestClient:
    from main import create_app

    return TestClient(create_app(build_settings(**overrides)))
