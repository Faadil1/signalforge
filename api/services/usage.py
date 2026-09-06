from __future__ import annotations

import threading
import time
from datetime import UTC, datetime


class UsageTracker:
    """Tracks real per-endpoint call counts and latency in-process."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._points: list[tuple[str, float, float]] = []  # (path, latency_ms, timestamp)
        self.started_at = datetime.now(UTC)

    def record(self, path: str, latency_ms: float) -> None:
        with self._lock:
            self._points.append((path, latency_ms, time.time()))
            # Cap retained points to bound memory.
            if len(self._points) > 10_000:
                self._points = self._points[-5000:]

    def summary(self) -> dict:
        with self._lock:
            total = len(self._points)
            now_ts = time.time()
            today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
            today = sum(1 for *_, ts in self._points if ts >= today_start)
            latencies = [lat for _, lat, _ in self._points]
            avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0
            by_path: dict[str, int] = {}
            for path, _, _ in self._points:
                by_path[path] = by_path.get(path, 0) + 1
            top = sorted(by_path.items(), key=lambda kv: kv[1], reverse=True)[:10]
            return {
                "total_calls": total,
                "calls_today": today,
                "avg_latency_ms": round(avg_latency, 1),
                "uptime_s": round(now_ts - self.started_at.timestamp()),
                "top_endpoints": [{"path": p, "count": c} for p, c in top],
            }


usage = UsageTracker()
