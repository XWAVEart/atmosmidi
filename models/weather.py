"""Weather data models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WeatherSnapshot(BaseModel):
    """Normalized current + derived weather values."""

    fetched_at: datetime
    latitude: float
    longitude: float
    timezone: str = "auto"
    values: dict[str, float] = Field(default_factory=dict)
    units: dict[str, str] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)
    from_cache: bool = False


class WeatherStatus(BaseModel):
    last_success_at: datetime | None = None
    last_attempt_at: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    poll_interval: float
    using_cache: bool = False
