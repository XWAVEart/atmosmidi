"""Open-Meteo weather fetcher with cache and backoff."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

import httpx

from config import CURRENT_VARIABLES, HOURLY_VARIABLES, OPEN_METEO_URL
from models.settings import AppSettings
from models.weather import WeatherSnapshot, WeatherStatus

logger = logging.getLogger(__name__)

OnWeatherUpdate = Callable[[WeatherSnapshot], Awaitable[None] | None]


class WeatherFetcher:
    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._client: httpx.AsyncClient | None = None
        self._task: asyncio.Task | None = None
        self._running = False
        self._cache: WeatherSnapshot | None = None
        self._status = WeatherStatus(poll_interval=settings.poll_interval)
        self._backoff = 1.0
        self._max_backoff = 300.0
        self._on_update: OnWeatherUpdate | None = None
        self._lock = asyncio.Lock()
        self._wake = asyncio.Event()

    @property
    def status(self) -> WeatherStatus:
        return self._status.model_copy()

    @property
    def latest(self) -> WeatherSnapshot | None:
        return self._cache

    def update_settings(self, settings: AppSettings) -> None:
        self._settings = settings
        self._status.poll_interval = settings.poll_interval

    def set_on_update(self, callback: OnWeatherUpdate) -> None:
        self._on_update = callback

    async def start(self) -> None:
        if self._running:
            return
        self._client = httpx.AsyncClient(timeout=20.0)
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="weather-fetcher")
        logger.info(
            "Weather fetcher started (%.4f, %.4f) every %.0fs",
            self._settings.latitude,
            self._settings.longitude,
            self._settings.poll_interval,
        )

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self._client:
            await self._client.aclose()
            self._client = None

    async def fetch_once(self) -> WeatherSnapshot:
        async with self._lock:
            return await self._fetch()

    def request_refresh(self) -> None:
        """Wake the poll loop to fetch immediately (e.g. after location change)."""
        self._wake.set()

    async def _loop(self) -> None:
        while self._running:
            try:
                snapshot = await self.fetch_once()
                if self._on_update:
                    result = self._on_update(snapshot)
                    if asyncio.iscoroutine(result):
                        await result
                self._wake.clear()
                try:
                    await asyncio.wait_for(
                        self._wake.wait(),
                        timeout=self._settings.poll_interval,
                    )
                except asyncio.TimeoutError:
                    pass
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("Weather loop error: %s", exc)
                await asyncio.sleep(min(self._backoff, self._max_backoff))

    async def _fetch(self) -> WeatherSnapshot:
        assert self._client is not None
        now = datetime.now(timezone.utc)
        self._status.last_attempt_at = now

        params = {
            "latitude": self._settings.latitude,
            "longitude": self._settings.longitude,
            "current": ",".join(CURRENT_VARIABLES),
            "hourly": ",".join(HOURLY_VARIABLES),
            "timezone": "auto",
            "forecast_days": 1,
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        }

        try:
            response = await self._client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            payload = response.json()
            snapshot = self._parse(payload, now)
            self._cache = snapshot
            self._status.last_success_at = now
            self._status.last_error = None
            self._status.consecutive_failures = 0
            self._status.using_cache = False
            self._backoff = 1.0
            logger.debug("Weather fetch OK (%d values)", len(snapshot.values))
            return snapshot
        except Exception as exc:
            self._status.consecutive_failures += 1
            self._status.last_error = str(exc)
            self._backoff = min(self._backoff * 2, self._max_backoff)
            logger.warning(
                "Weather fetch failed (%d): %s — backoff %.0fs",
                self._status.consecutive_failures,
                exc,
                self._backoff,
            )
            if self._cache is not None:
                cached = self._cache.model_copy(deep=True)
                cached.from_cache = True
                self._status.using_cache = True
                return cached
            raise

    def _parse(self, payload: dict[str, Any], fetched_at: datetime) -> WeatherSnapshot:
        values: dict[str, float] = {}
        units: dict[str, str] = {}

        current = payload.get("current") or {}
        current_units = payload.get("current_units") or {}
        for key, raw in current.items():
            if key in {"time", "interval"}:
                continue
            if raw is None:
                continue
            try:
                values[key] = float(raw)
                if key in current_units:
                    units[key] = str(current_units[key])
            except (TypeError, ValueError):
                continue

        # Prefer nearest hourly sample for variables missing from current
        hourly = payload.get("hourly") or {}
        hourly_units = payload.get("hourly_units") or {}
        times: list[str] = hourly.get("time") or []
        idx = self._nearest_hour_index(times, fetched_at)

        if idx is not None:
            for key, series in hourly.items():
                if key == "time" or not isinstance(series, list):
                    continue
                if key in values:
                    continue
                if idx >= len(series) or series[idx] is None:
                    continue
                try:
                    values[key] = float(series[idx])
                    if key in hourly_units:
                        units[key] = str(hourly_units[key])
                except (TypeError, ValueError):
                    continue

            # Keep a short history for rate-of-change consumers
            for key in ("temperature_2m", "pressure_msl", "wind_speed_10m"):
                series = hourly.get(key)
                if not isinstance(series, list) or idx < 1:
                    continue
                prev = series[idx - 1]
                curr = series[idx]
                if prev is None or curr is None:
                    continue
                try:
                    values[f"hourly_delta_{key}"] = float(curr) - float(prev)
                except (TypeError, ValueError):
                    continue

        return WeatherSnapshot(
            fetched_at=fetched_at,
            latitude=float(payload.get("latitude", self._settings.latitude)),
            longitude=float(payload.get("longitude", self._settings.longitude)),
            timezone=str(payload.get("timezone", "auto")),
            values=values,
            units=units,
            raw=payload,
            from_cache=False,
        )

    @staticmethod
    def _nearest_hour_index(times: list[str], now: datetime) -> int | None:
        if not times:
            return None
        best_i = 0
        best_delta = None
        for i, stamp in enumerate(times):
            try:
                # Open-Meteo local times without offset; treat as naive UTC-ish compare
                parsed = datetime.fromisoformat(stamp)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                delta = abs((parsed - now).total_seconds())
                if best_delta is None or delta < best_delta:
                    best_delta = delta
                    best_i = i
            except ValueError:
                continue
        return best_i
