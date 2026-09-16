from __future__ import annotations

import os

import httpx2
from workers import asgi, env

# Cloudflare bindings are not exposed through os.environ by default, while the
# existing SignalForge configuration layer intentionally reads os.getenv().
# Mirror only the reviewed, non-secret runtime bindings before importing the app.
for name in (
    "GIT_COMMIT",
    "PROJECT_SLUG",
    "ALLOW_MOCK_FALLBACK",
    "ENABLE_ALERTS",
    "ENABLE_BACKTESTS",
    "CORS_ORIGINS",
    "RATE_LIMIT_ENABLED",
):
    try:
        value = getattr(env, name)
    except Exception:
        continue
    if value is not None:
        os.environ[name] = str(value)

# Cloudflare Python Workers supports httpx2 for async outbound HTTP. Alias it
# before SignalForge imports its existing `httpx` client code so the public API
# contract remains unchanged outside this runtime adapter.
httpx2.alias_httpx()

# Binance Futures and Binance Spot currently return WAF HTTP 403 from this
# Cloudflare runtime, including with explicit FRA placement. Install a
# provenance-preserving market-data fallback chain: Binance remains preferred,
# Coinbase Exchange public ticker/klines is secondary, and futures-only
# evidence (funding/open interest) remains unavailable rather than synthesized.
from cloudflare_binance_adapter import install_cloudflare_binance_fallback  # noqa: E402

install_cloudflare_binance_fallback()

from main import app  # noqa: E402

Default = asgi.entrypoint(app)
