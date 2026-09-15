from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from services.decision_service import compare_with_live_decision, get_decision_packet, get_signal_delta
from services.errors import INVALID_TOKEN, error_token_payload
from services.rate_limit import rate_limit
from services.symbols import is_valid_token, normalize_token

router = APIRouter(tags=["decision"])


async def _decision_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="signal")


def _symbol_or_422(token: str) -> str:
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)
    return symbol


@router.get("/decision/{token}", dependencies=[Depends(_decision_rate_limited)])
async def decision(token: str):
    packet = await get_decision_packet(_symbol_or_422(token))
    if not packet.get("ok"):
        raise HTTPException(status_code=502, detail=packet)
    return packet


@router.get("/decision/{token}/delta", dependencies=[Depends(_decision_rate_limited)])
async def decision_delta(token: str):
    """Convenience delta using process-local memory; not durable across Worker isolates."""
    delta = await get_signal_delta(_symbol_or_422(token))
    if not delta.get("ok"):
        raise HTTPException(status_code=502, detail=delta)
    return delta


@router.post("/decision/{token}/compare", dependencies=[Depends(_decision_rate_limited)])
async def decision_compare(token: str, baseline: dict):
    """Compare a caller-supplied prior Decision Packet with a fresh live packet.

    This endpoint is stateless and reproducible across Worker isolates. It is the
    preferred agent integration path when durable delta semantics matter.
    """
    result = await compare_with_live_decision(_symbol_or_422(token), baseline)
    if not result.get("ok"):
        code = result.get("error", {}).get("code")
        caller_errors = {
            "INVALID_BASELINE",
            "TOKEN_MISMATCH",
            "BASELINE_CONTRACT_VERSION_MISMATCH",
        }
        raise HTTPException(status_code=422 if code in caller_errors else 502, detail=result)
    return result
