"""
ATHENA ML Service - FastAPI Application
========================================
Exposes ML algorithms as REST endpoints for the Node.js backend.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.api.routers import (
    career_compass,
    mentor_match,
    safety_score,
    income_stream,
    ranker,
    feed,
)
from src.api.services.model_loader import ModelLoader

# ===========================================
# LIFESPAN - Load Models on Startup
# ===========================================

model_loader = ModelLoader()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load what artefacts exist on startup, clean up on shutdown.

    This used to print "✅ ML models loaded successfully" unconditionally, on a
    line that could only ever be reached because the loader had raised on
    anything else. Now that a missing artefact is a reported state rather than a
    crash, the line has to say which of the two happened.
    """
    print("🚀 Loading ML models...")
    await model_loader.load_all_models()
    if model_loader.is_ready():
        print("✅ Every model an endpoint reads is loaded")
    else:
        print("⚠ Starting without every model: /health says which, and the endpoints that need them answer 503")
    yield
    print("🛑 Shutting down ML service...")
    await model_loader.cleanup()


# ===========================================
# APPLICATION SETUP
# ===========================================

app = FastAPI(
    title="ATHENA ML Service",
    description="Machine Learning API for the ATHENA Platform - Career Compass, Safety Score, Mentor Match, and more.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# The service is meant to sit on a private network behind the Node API. When a
# shared key is configured (ML_SERVICE_KEY, the same value the API sends as
# X-ML-Key) every request except the health check has to carry it, so an
# exposed port cannot be driven by anyone else.
ML_SERVICE_KEY = os.environ.get("ML_SERVICE_KEY", "").strip()


@app.middleware("http")
async def require_shared_key(request: Request, call_next):
    if ML_SERVICE_KEY and request.url.path not in ("/health", "/docs", "/redoc", "/openapi.json"):
        if request.headers.get("x-ml-key", "") != ML_SERVICE_KEY:
            return JSONResponse(status_code=401, content={"detail": "A valid X-ML-Key header is required"})
    return await call_next(request)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("NODE_SERVICE_URL", "http://localhost:3001"),
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================
# REQUEST TRACKING MIDDLEWARE
# ===========================================

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
    return response


# ===========================================
# HEALTH & STATUS ENDPOINTS
# ===========================================

class HealthResponse(BaseModel):
    status: str
    service: str = "athena-ml"
    version: str = "1.0.0"
    models_loaded: Dict[str, bool]
    models: Dict[str, Any]
    timestamp: float


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """
    Health check endpoint for container orchestration.

    ``status`` used to be the literal string "healthy" with no condition
    attached, while ``models_loaded`` sat beside it reporting false for every
    model. The Node API reads this endpoint and treats "healthy" as ready, so a
    service running with nothing loaded looked identical to one serving real
    predictions. It is now "degraded" whenever a model some endpoint reads is
    missing, and ``models`` carries the whole account — what was searched, what
    is absent, and what that costs.

    Still HTTP 200 when degraded, deliberately: the container is alive and the
    five routers that need no artefact are answering normally. ``/ready`` is
    where a probe that should pull this instance out of rotation looks.
    """
    report = model_loader.get_report()
    return HealthResponse(
        status="healthy" if model_loader.is_ready() else "degraded",
        models_loaded=model_loader.get_status(),
        models=report,
        timestamp=time.time(),
    )


@app.get("/ready", tags=["System"])
async def readiness_check():
    """Readiness probe - refuses while a model some endpoint reads is missing."""
    if not model_loader.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=model_loader.describe_missing(),
        )
    return {"status": "ready"}


# ===========================================
# INCLUDE ROUTERS
# ===========================================

app.include_router(career_compass.router, prefix="/api/v1/career-compass", tags=["Career Compass"])
app.include_router(mentor_match.router, prefix="/api/v1/mentor-match", tags=["Mentor Match"])
app.include_router(safety_score.router, prefix="/api/v1/safety-score", tags=["Safety Score"])
app.include_router(income_stream.router, prefix="/api/v1/income-stream", tags=["Income Stream"])
app.include_router(ranker.router, prefix="/api/v1/ranker", tags=["Ranking"])
app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed Algorithm"])


# ===========================================
# ERROR HANDLERS
# ===========================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": str(exc) if os.getenv("DEBUG") else "An unexpected error occurred",
            "path": str(request.url),
        },
    )


# ===========================================
# ROOT ENDPOINT
# ===========================================

@app.get("/", tags=["System"])
async def root():
    """Root endpoint with API information."""
    return {
        "service": "ATHENA ML Service",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health",
        "endpoints": {
            "career_compass": "/api/v1/career-compass",
            "mentor_match": "/api/v1/mentor-match",
            "safety_score": "/api/v1/safety-score",
            "income_stream": "/api/v1/income-stream",
            "ranker": "/api/v1/ranker",
            "feed": "/api/v1/feed",
        },
    }
