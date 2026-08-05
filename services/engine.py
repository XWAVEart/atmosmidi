"""Main AtmosMIDI runtime: weather → process → MIDI → live broadcast."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from models.mapping import Mapping
from models.settings import AppSettings, SystemStatus
from models.weather import WeatherSnapshot
from services.midi_engine import MidiEngine
from services.processor import SignalProcessor
from services.store import Store
from services.weather_fetcher import WeatherFetcher

logger = logging.getLogger(__name__)


class AtmosEngine:
    def __init__(self, store: Store | None = None) -> None:
        self.store = store or Store()
        self.weather = WeatherFetcher(self.store.settings)
        self.processor = SignalProcessor(self.store.settings)
        self.midi = MidiEngine(
            port_name=self.store.settings.midi_port_name,
            rate_limit_ms=self.store.settings.midi_rate_limit_ms,
        )
        self._started_at = time.time()
        self._running = False
        self._loop_task: asyncio.Task | None = None
        self._subscribers: set[asyncio.Queue] = set()
        self._tick_hz = 20.0
        self.weather.set_on_update(self._on_weather)

    @property
    def settings(self) -> AppSettings:
        return self.store.settings

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._started_at = time.time()
        self.midi.open()
        await self.weather.start()
        self._loop_task = asyncio.create_task(self._engine_loop(), name="atmos-engine")
        logger.info("AtmosMIDI engine started")

    async def stop(self) -> None:
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None
        await self.weather.stop()
        self.midi.close()
        logger.info("AtmosMIDI engine stopped")

    async def _on_weather(self, snapshot: WeatherSnapshot) -> None:
        self.processor.ingest(snapshot)
        await self._broadcast({"type": "weather", "data": self._weather_payload(snapshot)})

    async def _engine_loop(self) -> None:
        dt = 1.0 / self._tick_hz
        while self._running:
            frame_start = time.monotonic()
            try:
                self.processor.tick(dt)
                actions = self.processor.process_mappings(self.store.mappings)
                for mapping, value, action in actions:
                    if action == "skip":
                        continue
                    self.midi.send_mapping_action(mapping, value, action)

                await self._broadcast(
                    {
                        "type": "live",
                        "data": {
                            "signals": self.processor.signals,
                            "mappings": {
                                k: v.model_dump()
                                for k, v in self.processor.live_states.items()
                            },
                            "midi": self.midi.status(),
                            "global_enabled": self.settings.global_enabled,
                        },
                    }
                )
            except Exception:
                logger.exception("Engine tick failed")

            elapsed = time.monotonic() - frame_start
            await asyncio.sleep(max(0.001, dt - elapsed))

    def get_status(self) -> SystemStatus:
        weather_status = self.weather.status
        mappings = self.store.mappings
        return SystemStatus(
            running=self._running,
            global_enabled=self.settings.global_enabled,
            weather={
                **weather_status.model_dump(mode="json"),
                "has_data": self.weather.latest is not None,
                "value_count": len(self.weather.latest.values) if self.weather.latest else 0,
            },
            midi=self.midi.status(),
            mapping_count=len(mappings),
            enabled_mapping_count=sum(1 for m in mappings if m.enabled),
            uptime_seconds=time.time() - self._started_at,
        )

    def current_weather(self) -> dict[str, Any] | None:
        snap = self.weather.latest
        if snap is None:
            return None
        return self._weather_payload(snap)

    def raw_weather(self) -> dict[str, Any] | None:
        snap = self.weather.latest
        if snap is None:
            return None
        return snap.raw

    def _weather_payload(self, snap: WeatherSnapshot) -> dict[str, Any]:
        return {
            "fetched_at": snap.fetched_at.isoformat(),
            "latitude": snap.latitude,
            "longitude": snap.longitude,
            "timezone": snap.timezone,
            "from_cache": snap.from_cache,
            "values": snap.values,
            "units": snap.units,
            "derived": {
                k.replace("derived.", ""): v
                for k, v in self.processor.signals.items()
                if k.startswith("derived.") or k in {
                    "storminess",
                    "temp_tendency",
                    "pressure_tendency",
                    "wind_tendency",
                    "humidity_tendency",
                    "wind_shear",
                    "day_night_transition",
                    "humidity_temp_interaction",
                    "activity_score",
                }
            },
            "signals": self.processor.signals,
        }

    def update_settings(self, settings: AppSettings) -> AppSettings:
        saved = self.store.save_settings(settings)
        self.weather.update_settings(saved)
        self.processor.update_settings(saved)
        self.midi.port_name = saved.midi_port_name
        self.midi.rate_limit_ms = saved.midi_rate_limit_ms
        return saved

    def test_mapping(self, mapping_id: str) -> dict[str, Any]:
        mapping = self.store.get_mapping(mapping_id)
        if mapping is None:
            return {"ok": False, "error": "Mapping not found"}
        preview = self.processor.preview(mapping)
        value = preview.get("midi")
        return self.midi.test_mapping(mapping, value if isinstance(value, int) else None)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=8)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    async def _broadcast(self, message: dict[str, Any]) -> None:
        dead: list[asyncio.Queue] = []
        for queue in self._subscribers:
            try:
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(message)
            except Exception:
                dead.append(queue)
        for queue in dead:
            self._subscribers.discard(queue)

    # Mapping helpers that notify UI
    async def notify_mappings_changed(self) -> None:
        await self._broadcast(
            {
                "type": "mappings",
                "data": [m.model_dump() for m in self.store.mappings],
            }
        )

    def available_sources(self) -> list[str]:
        base = sorted(self.processor.signals.keys())
        derived = [
            "derived.storminess",
            "derived.temp_tendency",
            "derived.pressure_tendency",
            "derived.wind_tendency",
            "derived.humidity_tendency",
            "derived.wind_shear",
            "derived.day_night_transition",
            "derived.humidity_temp_interaction",
            "derived.activity_score",
            "generative.motion",
            "generative.pulse",
            "generative.event",
            "generative.drift",
        ]
        # Common Open-Meteo keys even before first fetch
        common = [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "dew_point_2m",
            "pressure_msl",
            "surface_pressure",
            "cloud_cover",
            "cloud_cover_low",
            "cloud_cover_mid",
            "cloud_cover_high",
            "visibility",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m",
            "wind_speed_80m",
            "precipitation",
            "rain",
            "showers",
            "snowfall",
            "weather_code",
            "is_day",
            "shortwave_radiation",
            "direct_radiation",
            "uv_index",
        ]
        return sorted(set(common + derived + base))
