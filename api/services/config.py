from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    # Feature flags (disabled by default for safe first deploy)
    enable_alerts: bool = False
    enable_backtests: bool = False

    # CORS
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])

    # Cache TTLs (seconds)
    signal_cache_ttl: int = 45
    candle_cache_ttl: int = 300
    error_cache_ttl: int = 10
    ticker_cache_ttl: int = 3
    cache_max_entries: int = 500

    # Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_general: int = 120  # per minute
    rate_limit_signal: int = 60
    rate_limit_overview: int = 30
    rate_limit_ticker: int = 180
    rate_limit_backtest: int = 10
    rate_limit_alert: int = 30

    # Batch limits
    max_batch_tokens: int = 10

    # Binance client
    binance_timeout_s: float = 10.0
    binance_max_retries: int = 2
    binance_max_concurrency: int = 5

    # Backtest
    backtest_fee_bps: int = 10
    backtest_slippage_bps: int = 5
    backtest_min_candles: int = 31

    @staticmethod
    def _parse_bool(value: str | None, default: bool) -> bool:
        if value is None:
            return default
        return value.strip().lower() not in ("0", "false", "no", "")

    @staticmethod
    def _parse_int(value: str | None, default: int) -> int:
        if value is None:
            return default
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _parse_float(value: str | None, default: float) -> float:
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _parse_cors(value: str | None, default: list[str]) -> list[str]:
        if not value:
            return default
        return [o.strip() for o in value.split(",") if o.strip()]

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            enable_alerts=cls._parse_bool(os.getenv("ENABLE_ALERTS"), False),
            enable_backtests=cls._parse_bool(os.getenv("ENABLE_BACKTESTS"), False),
            cors_origins=cls._parse_cors(os.getenv("CORS_ORIGINS"), ["http://localhost:3000"]),
            signal_cache_ttl=cls._parse_int(os.getenv("SIGNAL_CACHE_TTL"), 45),
            candle_cache_ttl=cls._parse_int(os.getenv("CANDLE_CACHE_TTL"), 300),
            error_cache_ttl=cls._parse_int(os.getenv("ERROR_CACHE_TTL"), 10),
            ticker_cache_ttl=cls._parse_int(os.getenv("TICKER_CACHE_TTL"), 3),
            cache_max_entries=cls._parse_int(os.getenv("CACHE_MAX_ENTRIES"), 500),
            rate_limit_enabled=cls._parse_bool(os.getenv("RATE_LIMIT_ENABLED"), True),
            rate_limit_general=cls._parse_int(os.getenv("RATE_LIMIT_GENERAL"), 120),
            rate_limit_signal=cls._parse_int(os.getenv("RATE_LIMIT_SIGNAL"), 60),
            rate_limit_overview=cls._parse_int(os.getenv("RATE_LIMIT_OVERVIEW"), 30),
            rate_limit_ticker=cls._parse_int(os.getenv("RATE_LIMIT_TICKER"), 180),
            rate_limit_backtest=cls._parse_int(os.getenv("RATE_LIMIT_BACKTEST"), 10),
            rate_limit_alert=cls._parse_int(os.getenv("RATE_LIMIT_ALERT"), 30),
            max_batch_tokens=cls._parse_int(os.getenv("MAX_BATCH_TOKENS"), 10),
            binance_timeout_s=cls._parse_float(os.getenv("BINANCE_TIMEOUT_S"), 10.0),
            binance_max_retries=cls._parse_int(os.getenv("BINANCE_MAX_RETRIES"), 2),
            binance_max_concurrency=cls._parse_int(os.getenv("BINANCE_MAX_CONCURRENCY"), 5),
            backtest_fee_bps=cls._parse_int(os.getenv("BACKTEST_FEE_BPS"), 10),
            backtest_slippage_bps=cls._parse_int(os.getenv("BACKTEST_SLIPPAGE_BPS"), 5),
            backtest_min_candles=cls._parse_int(os.getenv("BACKTEST_MIN_CANDLES"), 31),
        )


_settings: Settings | None = None


def get_settings(reload: bool = False) -> Settings:
    global _settings
    if _settings is None or reload:
        _settings = Settings.from_env()
    return _settings
