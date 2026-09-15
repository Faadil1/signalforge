from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.config import Settings


@pytest.fixture(autouse=True)
def _reset_global_state():
    from routes.alerts import _clear_alerts
    from services.cache import get_cache
    from services.config import get_settings
    from services.decision_service import _clear_decisions
    from services.rate_limit import _limiter

    get_cache().clear()
    _limiter.clear()
    _clear_alerts()
    _clear_decisions()
    get_settings(reload=True)
    yield
    get_cache().clear()
    _limiter.clear()
    _clear_alerts()
    _clear_decisions()
    get_settings(reload=True)


def build_settings(**overrides) -> Settings:
    base = Settings(rate_limit_enabled=False, enable_alerts=True, enable_backtests=True, git_commit="a" * 40)
    return Settings(**{**base.__dict__, **overrides})


def make_client(**overrides) -> TestClient:
    from main import create_app
    return TestClient(create_app(build_settings(**overrides)))
