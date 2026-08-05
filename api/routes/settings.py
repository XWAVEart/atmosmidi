"""Settings and preset routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.settings import AppSettings

router = APIRouter()


class PresetPayload(BaseModel):
    version: int = 1
    settings: dict[str, Any] | None = None
    mappings: list[dict[str, Any]] | None = None


def create_settings_routes(get_engine) -> APIRouter:
    r = APIRouter()

    @r.get("/api/settings")
    async def get_settings():
        return get_engine().settings

    @r.put("/api/settings")
    async def put_settings(body: AppSettings):
        engine = get_engine()
        saved = engine.update_settings(body)
        return saved


    @r.get("/api/presets/export")
    async def export_presets():
        return get_engine().store.export_presets()

    @r.post("/api/presets/import")
    async def import_presets(body: dict[str, Any]):
        engine = get_engine()
        try:
            result = engine.store.import_presets(body)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        engine.update_settings(engine.store.settings)
        await engine.notify_mappings_changed()
        return result

    return r
