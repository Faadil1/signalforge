from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Callable, Coroutine
from typing import Any


class TTLCache:
    """Simple async-safe TTL cache with max-entries eviction and per-key single-flight."""

    def __init__(self, max_entries: int = 500) -> None:
        self._max_entries = max_entries
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._locks: dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    def clear(self) -> None:
        self._store.clear()
        self._locks.clear()

    def get(self, key: str) -> tuple[Any, bool]:
        if key in self._store:
            value, expires_at = self._store[key]
            if time.monotonic() < expires_at:
                self._store.move_to_end(key)
                return value, True
            del self._store[key]
        return None, False

    def set(self, key: str, value: Any, ttl: float) -> None:
        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self._max_entries:
            self._store.popitem(last=False)
        self._store[key] = (value, time.monotonic() + ttl)

    async def _get_lock(self, key: str) -> asyncio.Lock:
        async with self._global_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Coroutine[Any, Any, Any]],
        ttl: float | None = None,
    ) -> tuple[Any, bool]:
        """Return (value, from_cache). Uses single-flight per key.

        When `ttl` is None, `factory` must return `(value, effective_ttl)` to
        allow callers to choose different TTLs for success vs error results.
        """
        cached, hit = self.get(key)
        if hit:
            return cached, True

        lock = await self._get_lock(key)
        async with lock:
            cached, hit = self.get(key)
            if hit:
                return cached, True
            if ttl is not None:
                result = await factory()
                value, effective_ttl = result, ttl
            else:
                result = await factory()
                try:
                    value, effective_ttl = result
                except (TypeError, ValueError):
                    raise TypeError("factory must return (value, ttl) when ttl is None") from None
            self.set(key, value, effective_ttl)
            return value, False


_cache: TTLCache | None = None


def get_cache(max_entries: int = 500) -> TTLCache:
    global _cache
    if _cache is None:
        _cache = TTLCache(max_entries=max_entries)
    return _cache
