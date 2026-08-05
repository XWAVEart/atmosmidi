"""Signal processor: normalize, scale, interpolate, derive, generative layers."""

from __future__ import annotations

import logging
import math
import time
from typing import Any

from models.mapping import Mapping, MappingLiveState
from models.settings import AppSettings
from models.weather import WeatherSnapshot
from services.generative import GenerativeEngine

logger = logging.getLogger(__name__)


def apply_curve(normalized: float, curve: str) -> float:
    """Map 0–1 through a shaping curve. Input should already be clamped."""
    x = max(0.0, min(1.0, normalized))
    if curve == "exponential":
        return x * x
    if curve == "logarithmic":
        return math.sqrt(x)
    if curve == "s-curve":
        # Smoothstep
        return x * x * (3.0 - 2.0 * x)
    return x


def scale_value(raw: float, mapping: Mapping, intensity: float = 1.0) -> int:
    span = mapping.input_max - mapping.input_min
    if span == 0:
        normalized = 0.0
    else:
        normalized = (raw - mapping.input_min) / span
    normalized = max(0.0, min(1.0, normalized))
    if mapping.invert:
        normalized = 1.0 - normalized
    curved = apply_curve(normalized, mapping.curve)
    out_span = mapping.output_max - mapping.output_min
    value = mapping.output_min + curved * out_span
    # Global intensity pulls toward mid-range when < 1, expands when > 1
    mid = (mapping.output_min + mapping.output_max) / 2.0
    value = mid + (value - mid) * intensity
    return int(round(max(0, min(127, value))))


class SignalProcessor:
    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._targets: dict[str, float] = {}
        self._smoothed: dict[str, float] = {}
        self._derived: dict[str, float] = {}
        self._history: dict[str, list[tuple[float, float]]] = {}
        self._prev_snapshot: WeatherSnapshot | None = None
        self._prev_time: float | None = None
        self._mapping_smoothed: dict[str, float] = {}
        self._last_sent: dict[str, int] = {}
        self._note_latched: dict[str, bool] = {}
        self._live: dict[str, MappingLiveState] = {}
        self._generative = GenerativeEngine(settings)

    def update_settings(self, settings: AppSettings) -> None:
        self._settings = settings
        self._generative.update_settings(settings)

    @property
    def signals(self) -> dict[str, float]:
        merged = dict(self._smoothed)
        merged.update(self._derived)
        merged.update(self._generative.values)
        return merged

    @property
    def live_states(self) -> dict[str, MappingLiveState]:
        return dict(self._live)

    def ingest(self, snapshot: WeatherSnapshot) -> dict[str, float]:
        now = time.monotonic()
        dt = 1.0 if self._prev_time is None else max(0.001, now - self._prev_time)
        self._prev_time = now

        for key, value in snapshot.values.items():
            self._targets[key] = value
            hist = self._history.setdefault(key, [])
            hist.append((now, value))
            if len(hist) > 64:
                del hist[:-64]

        self._compute_derived(snapshot, dt)
        self._generative.update(self._smoothed, self._derived, dt)
        self._prev_snapshot = snapshot
        return self.signals

    def tick(self, dt: float) -> dict[str, float]:
        """Advance interpolation toward targets every engine frame."""
        alpha = 1.0 - math.exp(-dt * 1.8)  # smooth approach, never hard jump
        for key, target in self._targets.items():
            current = self._smoothed.get(key, target)
            self._smoothed[key] = current + (target - current) * alpha

        self._generative.tick(dt)
        return self.signals

    def process_mappings(
        self, mappings: list[Mapping]
    ) -> list[tuple[Mapping, int, str]]:
        """
        Returns list of (mapping, midi_value, action) where action is
        'cc', 'note_on', 'note_off', or 'skip'.
        """
        signals = self.signals
        outputs: list[tuple[Mapping, int, str]] = []
        intensity = self._settings.global_intensity

        for mapping in mappings:
            raw = self._resolve_source(mapping.source, signals)
            state = MappingLiveState(
                id=mapping.id,
                source=mapping.source,
                enabled=mapping.enabled,
                raw_value=raw,
            )

            if not mapping.enabled or not self._settings.global_enabled or raw is None:
                self._live[mapping.id] = state
                continue

            # Per-mapping smoothing on the raw signal before scaling
            prev = self._mapping_smoothed.get(mapping.id, raw)
            smooth = max(0.0, min(1.0, mapping.smoothing))
            # Higher smoothing = slower response
            factor = 1.0 - smooth * 0.92
            smoothed = prev + (raw - prev) * factor
            self._mapping_smoothed[mapping.id] = smoothed

            # Light generative motion on continuous CCs
            if (
                mapping.midi_type == "cc"
                and self._settings.generative_enabled
                and self._settings.generative_motion_depth > 0
            ):
                motion = self._generative.motion_offset(mapping.id)
                span = mapping.input_max - mapping.input_min
                smoothed = smoothed + motion * span * self._settings.generative_motion_depth * 0.08

            midi_value = scale_value(smoothed, mapping, intensity)
            state.smoothed_value = smoothed
            state.midi_value = midi_value
            state.last_sent = self._last_sent.get(mapping.id)

            if mapping.midi_type == "cc":
                last = self._last_sent.get(mapping.id)
                if mapping.send_only_on_change and last is not None:
                    if abs(midi_value - last) < mapping.change_threshold:
                        self._live[mapping.id] = state
                        continue
                self._last_sent[mapping.id] = midi_value
                state.last_sent = midi_value
                outputs.append((mapping, midi_value, "cc"))
            else:
                # Note: fire on crossing mid threshold upward; off when falling
                threshold = (mapping.input_min + mapping.input_max) / 2.0
                latched = self._note_latched.get(mapping.id, False)
                if smoothed >= threshold and not latched:
                    self._note_latched[mapping.id] = True
                    self._last_sent[mapping.id] = midi_value
                    state.last_sent = midi_value
                    outputs.append((mapping, midi_value, "note_on"))
                elif smoothed < threshold and latched:
                    self._note_latched[mapping.id] = False
                    outputs.append((mapping, 0, "note_off"))

            self._live[mapping.id] = state

        return outputs

    def preview(self, mapping: Mapping, raw: float | None = None) -> dict[str, Any]:
        signals = self.signals
        value = raw if raw is not None else self._resolve_source(mapping.source, signals)
        if value is None:
            return {"raw": None, "midi": None}
        midi = scale_value(value, mapping, self._settings.global_intensity)
        return {"raw": value, "midi": midi}

    def _resolve_source(self, source: str, signals: dict[str, float]) -> float | None:
        if source.startswith("derived."):
            key = source.split(".", 1)[1]
            return self._derived.get(key, signals.get(f"derived_{key}"))
        if source.startswith("generative."):
            key = source.split(".", 1)[1]
            return self._generative.values.get(key)
        return signals.get(source)

    def _compute_derived(self, snapshot: WeatherSnapshot, dt: float) -> None:
        s = self._smoothed
        # Prefer smoothed; fall back to raw snapshot for first frame
        def g(key: str, default: float = 0.0) -> float:
            if key in s:
                return s[key]
            return float(snapshot.values.get(key, default))

        # Rate of change (°C/min, hPa/min, etc.)
        for key, out in (
            ("temperature_2m", "temp_tendency"),
            ("pressure_msl", "pressure_tendency"),
            ("wind_speed_10m", "wind_tendency"),
            ("relative_humidity_2m", "humidity_tendency"),
        ):
            roc = self._rate_of_change(key)
            if roc is None and f"hourly_delta_{key}" in snapshot.values:
                # hourly delta is per hour → convert to per minute-ish scale
                roc = snapshot.values[f"hourly_delta_{key}"] / 60.0
            self._derived[out] = 0.0 if roc is None else roc

        wind_10 = g("wind_speed_10m")
        wind_80 = g("wind_speed_80m", wind_10)
        wind_120 = g("wind_speed_120m", wind_80)
        self._derived["wind_shear"] = abs(wind_80 - wind_10) + 0.5 * abs(wind_120 - wind_80)

        gusts = g("wind_gusts_10m")
        precip = g("precipitation") + g("rain") + g("showers") + g("snowfall") * 2
        cloud = g("cloud_cover")
        pressure_drop = max(0.0, -self._derived["pressure_tendency"] * 10)
        storminess = (
            min(1.0, gusts / 80.0) * 0.35
            + min(1.0, precip / 5.0) * 0.30
            + min(1.0, cloud / 100.0) * 0.15
            + min(1.0, self._derived["wind_shear"] / 40.0) * 0.10
            + min(1.0, pressure_drop) * 0.10
        )
        self._derived["storminess"] = max(0.0, min(1.0, storminess)) * 100.0

        # Day/night transition strength from shortwave / is_day changes
        is_day = g("is_day", 1.0)
        radiation = g("shortwave_radiation", 0.0)
        if self._prev_snapshot is not None:
            prev_day = float(self._prev_snapshot.values.get("is_day", is_day))
            transition = abs(is_day - prev_day) * 100.0
        else:
            transition = 0.0
        # Soft peak near twilight when radiation is mid-range during day changes
        twilight = 0.0
        if 50 < radiation < 400:
            twilight = (1.0 - abs(radiation - 225) / 225) * 40.0
        self._derived["day_night_transition"] = max(transition, twilight)

        # Humidity–temperature interaction (heat index-ish / muggy score)
        temp = g("temperature_2m")
        humidity = g("relative_humidity_2m")
        dew = g("dew_point_2m", temp - (100 - humidity) / 5)
        muggy = max(0.0, (temp - 18.0)) * (humidity / 100.0) + max(0.0, dew - 12.0)
        self._derived["humidity_temp_interaction"] = muggy

        self._derived["activity_score"] = (
            self._derived["storminess"] * 0.5
            + min(100.0, wind_10 * 1.5) * 0.25
            + min(100.0, precip * 20) * 0.25
        )

        # Also expose with derived. prefix via resolve
        for key, value in list(self._derived.items()):
            self._smoothed[f"derived.{key}"] = value

    def _rate_of_change(self, key: str) -> float | None:
        hist = self._history.get(key)
        if not hist or len(hist) < 2:
            return None
        t0, v0 = hist[0]
        t1, v1 = hist[-1]
        dt = t1 - t0
        if dt < 1.0:
            return None
        # units per minute
        return (v1 - v0) / (dt / 60.0)
