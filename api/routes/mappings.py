"""Mapping CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.mapping import MappingCreate, MappingUpdate

router = APIRouter()


def create_mapping_routes(get_engine) -> APIRouter:
    r = APIRouter()

    @r.get("/api/mappings")
    async def list_mappings():
        return get_engine().store.list_mappings()

    @r.post("/api/mappings", status_code=201)
    async def create_mapping(body: MappingCreate):
        engine = get_engine()
        mapping = engine.store.create_mapping(body)
        await engine.notify_mappings_changed()
        return mapping

    @r.put("/api/mappings/{mapping_id}")
    async def update_mapping(mapping_id: str, body: MappingUpdate):
        engine = get_engine()
        mapping = engine.store.update_mapping(mapping_id, body)
        if mapping is None:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await engine.notify_mappings_changed()
        return mapping

    @r.delete("/api/mappings/{mapping_id}")
    async def delete_mapping(mapping_id: str):
        engine = get_engine()
        ok = engine.store.delete_mapping(mapping_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await engine.notify_mappings_changed()
        return {"ok": True}

    @r.post("/api/mappings/{mapping_id}/duplicate")
    async def duplicate_mapping(mapping_id: str):
        engine = get_engine()
        mapping = engine.store.duplicate_mapping(mapping_id)
        if mapping is None:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await engine.notify_mappings_changed()
        return mapping

    @r.post("/api/mappings/{mapping_id}/test")
    async def test_mapping(mapping_id: str):
        result = get_engine().test_mapping(mapping_id)
        if not result.get("ok") and result.get("error") == "Mapping not found":
            raise HTTPException(status_code=404, detail="Mapping not found")
        return result

    return r
