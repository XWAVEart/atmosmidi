"""Light generative layers biased by weather."""

from __future__ import annotations

import math
import random
import time

from models.settings import AppSettings


class GenerativeEngine:
    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._phase = random.random() * math.tau
        self._chaos_phase = random.random() * math.tau
        self._values: dict[str, float] = {
            "motion": 0.0,
            "pulse": 0.0,
            "event": 0.0,
            "drift": 0.0,
        }
        self._event_hold = 0.0
        self._mapping_phases: dict[str, float] = {}
        self._storminess = 0.0
        self._wind = 0.0

    @property
    def values(self) -> dict[str, float]:
        return {
            "generative.motion": self._values["motion"],
            "generative.pulse": self._values["pulse"],
            "generative.event": self._values["event"],
            "generative.drift": self._values["drift"],
            "motion": self._values["motion"],
            "pulse": self._values["pulse"],
            "event": self._values["event"],
            "drift": self._values["drift"],
        }

    def update_settings(self, settings: AppSettings) -> None:
        self._settings = settings

    def update(
        self,
        smoothed: dict[str, float],
        derived: dict[str, float],
        dt: float,
    ) -> None:
        self._storminess = derived.get("storminess", 0.0) / 100.0
        self._wind = smoothed.get("wind_speed_10m", 0.0)

    def tick(self, dt: float) -> None:
        if not self._settings.generative_enabled:
            self._values = {k: 0.0 for k in self._values}
            return

        depth = self._settings.generative_motion_depth
        chaos = self._settings.generative_chaos
        event_p = self._settings.generative_event_probability

        # Wind + storminess bias LFO rates
        rate = 0.05 + self._wind / 200.0 + self._storminess * 0.15
        self._phase += dt * rate * math.tau
        self._chaos_phase += dt * (0.03 + chaos * 0.4) * math.tau

        motion = math.sin(self._phase) * depth
        chaos_n = math.sin(self._chaos_phase * 2.7) * chaos * 0.5
        pulse = (math.sin(self._phase * 2.0) + 1.0) * 0.5 * depth
        drift = math.sin(self._phase * 0.25 + self._chaos_phase) * depth * 0.6

        # Stochastic weather-biased events
        self._event_hold = max(0.0, self._event_hold - dt)
        trigger_chance = event_p * dt * (0.2 + self._storminess * 1.5)
        if self._event_hold <= 0 and random.random() < trigger_chance:
            self._event_hold = 0.15 + random.random() * 0.5 * (0.5 + self._storminess)

        self._values = {
            "motion": motion + chaos_n,
            "pulse": pulse,
            "event": 1.0 if self._event_hold > 0 else 0.0,
            "drift": drift,
        }

    def motion_offset(self, mapping_id: str) -> float:
        phase = self._mapping_phases.get(mapping_id)
        if phase is None:
            phase = random.random() * math.tau
            self._mapping_phases[mapping_id] = phase
        t = time.monotonic()
        return math.sin(t * 0.35 + phase) * 0.5 + math.sin(t * 0.11 + phase * 1.7) * 0.5
