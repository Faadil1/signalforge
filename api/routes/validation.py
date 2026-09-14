from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from services.binance_client import BinancePublicError
from services.errors import INVALID_TOKEN, SIGNAL_FETCH_FAILED, error_token_payload
from services.rate_limit import rate_limit
from services.symbols import is_valid_token, normalize_token
from services.validation_service import run_signal_validation

router = APIRouter(tags=["validation"])


async def _validation_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="backtest")


@router.get("/validation/{token}", dependencies=[Depends(_validation_rate_limited)])
async def validation(token: str, period_days: int = Query(default=120, ge=45, le=365), horizon_days: int = Query(default=3, ge=1, le=7)):
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        raise HTTPException(status_code=422, detail=error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$"))
    try:
        return await run_signal_validation(symbol, period_days=period_days, horizon_days=horizon_days)
    except (BinancePublicError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=error_token_payload(symbol, SIGNAL_FETCH_FAILED, str(exc))) from exc
