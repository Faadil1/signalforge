from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from models.signal import RawSignalBundle
from services.binance_client import BinancePublicError, binance
from services.signal_fusion import payload_from_bundle

router = APIRouter(tags=["signals"])

DEFAULT_TOKENS = ["BTC", "ETH", "SOL"]


async def _wrap(coro):
    try:
        return await coro
    except BinancePublicError as e:
        raise HTTPException(status_code=502, detail={"error": "Binance upstream error", "detail": str(e)}) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "signal error", "detail": str(e)}) from e


@router.get("/signal/{token}")
async def get_signal(token: str):
    symbol = token.upper()
    sources = await _wrap(binance.fetch_signal_sources(symbol))
    bundle = RawSignalBundle(**sources)
    return payload_from_bundle(bundle)


@router.get("/signals")
async def get_all_signals(tokens: str = Query(default=",".join(DEFAULT_TOKENS))):
    token_list = [t.strip().upper() for t in tokens.split(",") if t.strip()]
    results = []
    for token in token_list:
        try:
            sources = await binance.fetch_signal_sources(token)
            bundle = RawSignalBundle(**sources)
            p = payload_from_bundle(bundle)
            results.append(
                {
                    "token": p["token"],
                    "price": p["price"],
                    "score": p["score"],
                    "confidence": p["confidence"],
                    "recommendation": p["recommendation"],
                }
            )
        except Exception as e:
            results.append({"token": token.upper(), "error": str(e)})
    return {"signals": results, "count": len(results)}


@router.get("/signal/{token}/history")
async def get_signal_history(token: str, days: int = Query(default=30, ge=1, le=90)):
    symbol = token.upper()
    klines = await _wrap(binance.get_klines(symbol, interval="1d", limit=days))
    history = []
    for k in klines:
        history.append(
            {
                "date": k["date"],
                "close": k["close"],
                "high": k["high"],
                "low": k["low"],
                "volume": k["volume"],
            }
        )
    return {"token": symbol, "history": history}


@router.get("/overview")
async def get_overview():
    tokens = ["BTC", "ETH", "SOL", "BNB", "XRP"]
    cards = []
    for t in tokens:
        try:
            sources = await binance.fetch_signal_sources(t)
            bundle = RawSignalBundle(**sources)
            p = payload_from_bundle(bundle)
            cards.append(
                {
                    "token": p["token"],
                    "price": p["price"],
                    "score": p["score"],
                    "confidence": p["confidence"],
                    "recommendation": p["recommendation"],
                }
            )
        except Exception as e:
            cards.append({"token": t, "error": str(e)})
    return {"market_cards": cards}
