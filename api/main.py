"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.routes.mappings import create_mapping_routes
from api.routes.settings import create_settings_routes
from api.routes.status import create_status_routes
from api.websocket import create_ws_router
from config import ROOT_DIR
from services.engine import AtmosEngine

logger = logging.getLogger(__name__)

_engine: AtmosEngine | None = None


def get_engine() -> AtmosEngine:
    if _engine is None:
        raise RuntimeError("Engine not initialized")
    return _engine


def create_app(engine: AtmosEngine | None = None) -> FastAPI:
    global _engine

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        global _engine
        _engine = engine or AtmosEngine()
        await _engine.start()
        logger.info("API ready")
        try:
            yield
        finally:
            await _engine.stop()
            _engine = None

    app = FastAPI(
        title="AtmosMIDI",
        description="Weather → MIDI Generative Engine",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8742",
            "http://127.0.0.1:8742",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(create_status_routes(get_engine))
    app.include_router(create_mapping_routes(get_engine))
    app.include_router(create_settings_routes(get_engine))
    app.include_router(create_ws_router(get_engine))

    dist = ROOT_DIR / "frontend" / "dist"
    if dist.exists():
        assets = dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/")
        async def spa_index():
            return FileResponse(dist / "index.html")

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            if full_path.startswith("api") or full_path.startswith("ws"):
                raise HTTPException(status_code=404, detail="Not found")
            candidate = dist / full_path
            if candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app
