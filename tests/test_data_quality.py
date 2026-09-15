from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from services.binance_client import BinancePublicClient
from services.data_quality import assess_freshness, summarize_quality


def _ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


def test_freshness_classifies_fresh_stale_unknown_and_inconsistent() -> None:
    now = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)

    fresh = assess_freshness("ticker", _ms(now - timedelta(seconds=30)), now=now)
    stale = assess_freshness("ticker", _ms(now - timedelta(minutes=10)), now=now)
    unknown = assess_freshness("ticker", None, now=now)
    inconsistent = assess_freshness("ticker", _ms(now + timedelta(minutes=5)), now=now)

    assert fresh["status"] == "fresh"
    assert stale["status"] == "stale"
    assert unknown["status"] == "unknown"
    assert inconsistent["status"] == "inconsistent"


def test_mock_is_explicit_not_fresh_live_evidence() -> None:
    now = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    record = assess_freshness("funding", None, now=now, provider_state="mock")
    assert record["status"] == "mock"
    assert record["source_timestamp"] is None


def test_quality_summary_preserves_negative_states() -> None:
    summary = summarize_quality(
        {
            "ticker": {"status": "fresh"},
            "klines": {"status": "fresh"},
            "open_interest": {"status": "stale"},
            "funding": {"status": "unavailable"},
        }
    )
    assert summary["healthy_sources"] == ["klines", "ticker"]
    assert summary["stale_sources"] == ["open_interest"]
    assert summary["unavailable_sources"] == ["funding"]


def test_binance_client_removes_stale_evidence_before_fusion() -> None:
    now = datetime.now(UTC)
    now_ms = _ms(now)
    stale_ms = _ms(now - timedelta(minutes=30))

    async def ticker(_symbol: str):
        return {
            "symbol": "BTC",
            "last_price": 60000.0,
            "price_change_pct": 1.0,
            "volume": 1000.0,
            "close_time": now_ms,
        }

    async def spot(_symbol: str):
        return await ticker(_symbol)

    async def klines(_symbol: str, interval: str = "1d", limit: int = 120):
        return [
            {
                "date": now.strftime("%Y-%m-%d"),
                "open_time": now_ms,
                "close": 60000.0,
                "open": 59900.0,
                "high": 60100.0,
                "low": 59800.0,
                "volume": 1000.0,
            }
        ]

    async def oi(_symbol: str):
        return {"symbol": "BTC", "open_interest": 25000.0, "time": stale_ms}

    async def funding(_symbol: str):
        return {"symbol": "BTC", "last_funding_rate": 0.0001, "time": now_ms}

    client = BinancePublicClient(allow_mock_fallback=False)
    client.client = object()
    client._semaphore = asyncio.Semaphore(5)
    client.get_futures_ticker = ticker
    client._get_spot_ticker = spot
    client.get_klines = klines
    client.get_open_interest = oi
    client.get_funding = funding

    payload = asyncio.run(client.fetch_signal_sources("BTC"))

    assert payload["open_interest"] == {}
    assert payload["source_meta"]["freshness"]["open_interest"]["status"] == "stale"
    assert payload["source_meta"]["mode"] == "live_partial"
    assert "open_interest" in payload["source_meta"]["quality_summary"]["stale_sources"]
