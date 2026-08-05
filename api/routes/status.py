"""Status and weather routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


def create_status_routes(get_engine) -> APIRouter:
    r = APIRouter()

    @r.get("/api/status")
    async def get_status():
        return get_engine().get_status()

    @r.get("/api/weather/current")
    async def get_weather_current():
        data = get_engine().current_weather()
        if data is None:
            raise HTTPException(status_code=503, detail="Weather data not yet available")
        return data

    @r.get("/api/weather/raw")
    async def get_weather_raw():
        data = get_engine().raw_weather()
        if data is None:
            raise HTTPException(status_code=503, detail="Weather data not yet available")
        return data

    @r.get("/api/sources")
    async def get_sources():
        return {"sources": get_engine().available_sources()}

    return r
