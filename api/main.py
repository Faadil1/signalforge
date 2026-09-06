import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from routes import alerts, playground, signals, strategies
from services.usage import usage

app = FastAPI(
    title="SignalForge",
    description="Multi-signal crypto trading intelligence computed from live Binance market data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def track_usage(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    latency_ms = (time.perf_counter() - start) * 1000
    if request.url.path.startswith("/api/"):
        usage.record(request.url.path, latency_ms)
    return response


app.include_router(signals.router, prefix="/api/v1")
app.include_router(strategies.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(playground.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "signalforge"}
