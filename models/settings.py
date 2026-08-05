"""Application settings models."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from config import (
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_POLL_INTERVAL,
    MIDI_PORT_NAME,
)


class AppSettings(BaseModel):
    latitude: float = DEFAULT_LATITUDE
    longitude: float = DEFAULT_LONGITUDE
    location_label: str = "Frederick / Reisterstown, MD"
    poll_interval: float = DEFAULT_POLL_INTERVAL
    midi_port_name: str = MIDI_PORT_NAME
    global_enabled: bool = True
    global_intensity: float = Field(default=1.0, ge=0.0, le=2.0)
    generative_enabled: bool = True
    generative_motion_depth: float = Field(default=0.25, ge=0.0, le=1.0)
    generative_event_probability: float = Field(default=0.15, ge=0.0, le=1.0)
    generative_chaos: float = Field(default=0.1, ge=0.0, le=1.0)
    theme: str = "dark"
    midi_rate_limit_ms: int = Field(default=20, ge=1, le=500)

    @field_validator("poll_interval")
    @classmethod
    def validate_poll_interval(cls, value: float) -> float:
        if value < 15:
            raise ValueError("poll_interval must be at least 15 seconds")
        if value > 600:
            raise ValueError("poll_interval must be at most 600 seconds")
        return value


class SystemStatus(BaseModel):
    running: bool
    global_enabled: bool
    weather: dict
    midi: dict
    mapping_count: int
    enabled_mapping_count: int
    uptime_seconds: float
    version: str = "0.1.0"
