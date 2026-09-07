from __future__ import annotations

from services.config import Settings


def test_defaults_align_with_documented_safety_profile() -> None:
    s = Settings()
    assert s.enable_alerts is False
    assert s.enable_backtests is False
    assert s.rate_limit_enabled is True
    assert s.cors_origins == ["http://localhost:3000"]
    assert s.max_batch_tokens == 10
    assert s.backtest_fee_bps == 10
    assert s.backtest_slippage_bps == 5
    assert s.backtest_min_candles == 31


def test_from_env_parses_every_type(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_ALERTS", "true")
    monkeypatch.setenv("ENABLE_BACKTESTS", "1")
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    monkeypatch.setenv("SIGNAL_CACHE_TTL", "12")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_SIGNAL", "5")
    monkeypatch.setenv("MAX_BATCH_TOKENS", "3")
    monkeypatch.setenv("BACKTEST_FEE_BPS", "25")
    monkeypatch.setenv("BACKTEST_SLIPPAGE_BPS", "10")
    monkeypatch.setenv("BINANCE_TIMEOUT_S", "4.5")

    s = Settings.from_env()
    assert s.enable_alerts is True
    assert s.enable_backtests is True
    assert s.cors_origins == ["https://a.example", "https://b.example"]
    assert s.signal_cache_ttl == 12
    assert s.rate_limit_enabled is False
    assert s.rate_limit_signal == 5
    assert s.max_batch_tokens == 3
    assert s.backtest_fee_bps == 25
    assert s.backtest_slippage_bps == 10
    assert s.binance_timeout_s == 4.5


def test_from_env_rejects_invalid_values_with_defaults(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_ALERTS", "definitely-not-a-bool")
    monkeypatch.setenv("SIGNAL_CACHE_TTL", "not-an-int")
    monkeypatch.setenv("BINANCE_TIMEOUT_S", "abc")

    s = Settings.from_env()
    assert s.enable_alerts is True  # anything other than false-y parses as enabled
    assert s.signal_cache_ttl == 45
    assert s.binance_timeout_s == 10.0


def test_get_settings_env_mutation_reload(monkeypatch) -> None:
    from services.config import get_settings

    before = get_settings()
    assert before.enable_backtests is False

    monkeypatch.setenv("ENABLE_BACKTESTS", "true")
    after = get_settings(reload=True)
    assert after.enable_backtests is True
    assert get_settings() is after

    monkeypatch.setenv("ENABLE_BACKTESTS", "false")
    get_settings(reload=True)
