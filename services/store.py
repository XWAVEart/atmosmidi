"""JSON persistence for mappings and settings."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

from config import DATA_DIR, MAPPINGS_PATH, SETTINGS_PATH
from models.mapping import Mapping, MappingCreate, MappingUpdate
from models.settings import AppSettings

logger = logging.getLogger(__name__)

TEMPERATURE_SOURCES = frozenset(
    {
        "temperature_2m",
        "apparent_temperature",
        "dew_point_2m",
    }
)


def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    if from_unit == to_unit:
        return value
    if from_unit == "celsius" and to_unit == "fahrenheit":
        return value * 9.0 / 5.0 + 32.0
    return (value - 32.0) * 5.0 / 9.0


DEFAULT_MAPPINGS: list[dict[str, Any]] = [
    {
        "id": "temp-cc1",
        "name": "Temperature → Mod Wheel",
        "source": "temperature_2m",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 1,
        "input_min": -10,
        "input_max": 40,
        "output_min": 0,
        "output_max": 127,
        "curve": "linear",
        "smoothing": 0.4,
    },
    {
        "id": "humidity-cc71",
        "name": "Humidity → Resonance",
        "source": "relative_humidity_2m",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 71,
        "input_min": 0,
        "input_max": 100,
        "curve": "s-curve",
        "smoothing": 0.35,
    },
    {
        "id": "wind-cc16",
        "name": "Wind Speed → LFO Rate",
        "source": "wind_speed_10m",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 16,
        "input_min": 0,
        "input_max": 80,
        "curve": "exponential",
        "smoothing": 0.25,
    },
    {
        "id": "gusts-cc17",
        "name": "Wind Gusts → Density",
        "source": "wind_gusts_10m",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 17,
        "input_min": 0,
        "input_max": 100,
        "curve": "exponential",
        "smoothing": 0.15,
        "change_threshold": 1.0,
    },
    {
        "id": "pressure-cc74",
        "name": "Pressure → Brightness",
        "source": "pressure_msl",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 74,
        "input_min": 980,
        "input_max": 1040,
        "curve": "linear",
        "smoothing": 0.5,
    },
    {
        "id": "clouds-cc18",
        "name": "Cloud Cover → Voice Density",
        "source": "cloud_cover",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 18,
        "input_min": 0,
        "input_max": 100,
        "curve": "logarithmic",
        "smoothing": 0.4,
    },
    {
        "id": "precip-cc19",
        "name": "Precipitation → Noise Layer",
        "source": "precipitation",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 19,
        "input_min": 0,
        "input_max": 5,
        "curve": "exponential",
        "smoothing": 0.2,
    },
    {
        "id": "storm-cc11",
        "name": "Storminess → Master Intensity",
        "source": "derived.storminess",
        "enabled": True,
        "midi_type": "cc",
        "channel": 1,
        "cc_number": 11,
        "input_min": 0,
        "input_max": 100,
        "curve": "s-curve",
        "smoothing": 0.3,
    },
]


class Store:
    def __init__(
        self,
        mappings_path: Path = MAPPINGS_PATH,
        settings_path: Path = SETTINGS_PATH,
    ) -> None:
        self.mappings_path = mappings_path
        self.settings_path = settings_path
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.settings = self._load_settings()
        self.mappings: list[Mapping] = self._load_mappings()

    def _load_settings(self) -> AppSettings:
        if self.settings_path.exists():
            try:
                data = json.loads(self.settings_path.read_text())
                return AppSettings.model_validate(data)
            except Exception as exc:
                logger.warning("Failed to load settings: %s", exc)
        settings = AppSettings()
        self.save_settings(settings)
        return settings

    def _load_mappings(self) -> list[Mapping]:
        if self.mappings_path.exists():
            try:
                data = json.loads(self.mappings_path.read_text())
                return [Mapping.model_validate(item) for item in data]
            except Exception as exc:
                logger.warning("Failed to load mappings: %s", exc)
        mappings = [Mapping.model_validate(item) for item in DEFAULT_MAPPINGS]
        self.save_mappings(mappings)
        return mappings

    def save_settings(self, settings: AppSettings | None = None) -> AppSettings:
        if settings is not None:
            self.settings = settings
        self.settings_path.write_text(
            self.settings.model_dump_json(indent=2) + "\n"
        )
        return self.settings

    def save_mappings(self, mappings: list[Mapping] | None = None) -> list[Mapping]:
        if mappings is not None:
            self.mappings = mappings
        payload = [m.model_dump() for m in self.mappings]
        self.mappings_path.write_text(json.dumps(payload, indent=2) + "\n")
        return self.mappings

    def list_mappings(self) -> list[Mapping]:
        return list(self.mappings)

    def get_mapping(self, mapping_id: str) -> Mapping | None:
        return next((m for m in self.mappings if m.id == mapping_id), None)

    def create_mapping(self, body: MappingCreate) -> Mapping:
        mapping = Mapping.model_validate(
            {**body.model_dump(), "id": str(uuid4())}
        )
        self.mappings.append(mapping)
        self.save_mappings()
        return mapping

    def update_mapping(self, mapping_id: str, body: MappingUpdate) -> Mapping | None:
        existing = self.get_mapping(mapping_id)
        if existing is None:
            return None
        data = existing.model_dump()
        updates = body.model_dump(exclude_unset=True)
        data.update(updates)
        updated = Mapping.model_validate(data)
        self.mappings = [
            updated if m.id == mapping_id else m for m in self.mappings
        ]
        self.save_mappings()
        return updated

    def delete_mapping(self, mapping_id: str) -> bool:
        before = len(self.mappings)
        self.mappings = [m for m in self.mappings if m.id != mapping_id]
        if len(self.mappings) == before:
            return False
        self.save_mappings()
        return True

    def duplicate_mapping(self, mapping_id: str) -> Mapping | None:
        existing = self.get_mapping(mapping_id)
        if existing is None:
            return None
        data = existing.model_dump()
        data["id"] = str(uuid4())
        data["name"] = f"{existing.name or existing.source} (copy)"
        copy = Mapping.model_validate(data)
        self.mappings.append(copy)
        self.save_mappings()
        return copy

    def convert_temperature_mappings(self, from_unit: str, to_unit: str) -> int:
        """Scale temperature mapping input ranges when °C/°F changes."""
        if from_unit == to_unit:
            return 0
        changed = 0
        updated: list[Mapping] = []
        for mapping in self.mappings:
            if mapping.source not in TEMPERATURE_SOURCES:
                updated.append(mapping)
                continue
            data = mapping.model_dump()
            data["input_min"] = round(
                convert_temperature(mapping.input_min, from_unit, to_unit), 2
            )
            data["input_max"] = round(
                convert_temperature(mapping.input_max, from_unit, to_unit), 2
            )
            updated.append(Mapping.model_validate(data))
            changed += 1
        if changed:
            self.save_mappings(updated)
        return changed

    def export_presets(self) -> dict[str, Any]:
        return {
            "version": 1,
            "settings": self.settings.model_dump(),
            "mappings": [m.model_dump() for m in self.mappings],
        }

    def import_presets(self, payload: dict[str, Any]) -> dict[str, Any]:
        if "settings" in payload:
            self.settings = AppSettings.model_validate(payload["settings"])
            self.save_settings()
        if "mappings" in payload:
            self.mappings = [
                Mapping.model_validate(item) for item in payload["mappings"]
            ]
            self.save_mappings()
        return self.export_presets()
