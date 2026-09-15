from __future__ import annotations

import asyncio

import services.decision_service as decision_service


def _payload(score=70.0):
    return {
        "ok": True, "token": "BTC", "price": 70000.0, "score": score, "confidence": 0.62,
        "recommendation": "buy" if score >= 60 else "hold", "timestamp": "2026-09-14T20:00:00+00:00",
        "available_signals": 5, "total_signals": 5, "coverage": 1.0,
        "actionability": "actionable" if score >= 60 else "observe", "execution_authorized": False,
        "data_mode": "live", "source_meta": {"provider": "binance_public", "sources": {"ticker": "binance_futures"}, "observed_at": "2026-09-14T20:00:00+00:00"},
        "sub_signals": [
            {"name": "technical", "value": 68.0, "confidence": 0.7, "available": True, "reason": "test"},
            {"name": "trend", "value": score, "confidence": 0.6, "available": True, "reason": "test"},
            {"name": "funding", "value": 45.0, "confidence": 0.55, "available": True, "reason": "test"},
            {"name": "open_interest", "value": 58.0, "confidence": 0.45, "available": True, "reason": "test"},
            {"name": "volume", "value": 65.0, "confidence": 0.5, "available": True, "reason": "test"},
        ],
    }


def test_decision_packet_is_evidence_bound(monkeypatch):
    async def fake(_token):
        return _payload()
    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    packet = asyncio.run(decision_service.get_decision_packet("BTC"))
    assert packet["stance"] == "buy"
    assert packet["execution_authorized"] is False
    assert packet["data_quality"]["mode"] == "live"
    assert packet["evidence"]["supporting"]
    assert packet["snapshot_id"]


def test_delta_establishes_baseline_then_detects_change(monkeypatch):
    state = {"score": 65.0}
    async def fake(_token):
        return _payload(state["score"])
    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    decision_service._clear_decisions()
    assert asyncio.run(decision_service.get_signal_delta("BTC"))["baseline_established"] is True
    state["score"] = 75.0
    second = asyncio.run(decision_service.get_signal_delta("BTC"))
    assert second["material_change"] is True
    assert second["score_delta"] == 10.0
