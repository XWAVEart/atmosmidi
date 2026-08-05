"""macOS virtual MIDI output via python-rtmidi / mido."""

from __future__ import annotations

import logging
import time
from typing import Any

import mido

from config import MIDI_PORT_NAME
from models.mapping import Mapping

logger = logging.getLogger(__name__)


class MidiEngine:
    def __init__(self, port_name: str = MIDI_PORT_NAME, rate_limit_ms: int = 20) -> None:
        self.port_name = port_name
        self.rate_limit_ms = rate_limit_ms
        self._port: mido.ports.BaseOutput | None = None
        self._connected = False
        self._last_error: str | None = None
        self._messages_sent = 0
        self._last_send_at = 0.0
        self._last_message_at: float | None = None
        self._virtual = False

    @property
    def connected(self) -> bool:
        return self._connected and self._port is not None

    def status(self) -> dict[str, Any]:
        return {
            "port_name": self.port_name,
            "connected": self.connected,
            "virtual": self._virtual,
            "messages_sent": self._messages_sent,
            "last_error": self._last_error,
            "last_message_at": self._last_message_at,
            "available_outputs": self.list_outputs(),
        }

    @staticmethod
    def list_outputs() -> list[str]:
        try:
            return list(mido.get_output_names())
        except Exception:
            return []

    def open(self) -> bool:
        self.close()
        try:
            # Prefer creating a virtual port so Ableton always sees "AtmosMIDI"
            self._port = mido.open_output(self.port_name, virtual=True)
            self._virtual = True
            self._connected = True
            self._last_error = None
            logger.info("Opened virtual MIDI port '%s'", self.port_name)
            return True
        except Exception as virtual_exc:
            logger.warning("Virtual port failed (%s); trying existing ports", virtual_exc)
            try:
                names = mido.get_output_names()
                match = next((n for n in names if self.port_name in n), None)
                if match is None and names:
                    # Fall back to IAC Bus if present
                    match = next((n for n in names if "IAC" in n), None)
                if match is None:
                    raise RuntimeError(
                        f"No MIDI output matching '{self.port_name}'. "
                        "Enable IAC Driver in Audio MIDI Setup or allow virtual ports."
                    )
                self._port = mido.open_output(match)
                self.port_name = match
                self._virtual = False
                self._connected = True
                self._last_error = None
                logger.info("Opened existing MIDI port '%s'", match)
                return True
            except Exception as exc:
                self._connected = False
                self._last_error = str(exc)
                logger.error("MIDI open failed: %s", exc)
                return False

    def close(self) -> None:
        if self._port is not None:
            try:
                self._port.close()
            except Exception:
                pass
            self._port = None
        self._connected = False

    def ensure_connected(self) -> bool:
        if self.connected:
            return True
        return self.open()

    def send_cc(self, channel: int, control: int, value: int) -> bool:
        ch = max(0, min(15, channel - 1))
        msg = mido.Message(
            "control_change",
            channel=ch,
            control=max(0, min(127, control)),
            value=max(0, min(127, value)),
        )
        return self._send(msg)

    def send_note_on(self, channel: int, note: int, velocity: int) -> bool:
        ch = max(0, min(15, channel - 1))
        msg = mido.Message(
            "note_on",
            channel=ch,
            note=max(0, min(127, note)),
            velocity=max(0, min(127, velocity)),
        )
        return self._send(msg)

    def send_note_off(self, channel: int, note: int) -> bool:
        ch = max(0, min(15, channel - 1))
        msg = mido.Message(
            "note_off",
            channel=ch,
            note=max(0, min(127, note)),
            velocity=0,
        )
        return self._send(msg)

    def send_mapping_action(self, mapping: Mapping, value: int, action: str) -> bool:
        if action == "cc":
            if mapping.cc_number is None:
                return False
            return self.send_cc(mapping.channel, mapping.cc_number, value)
        if action == "note_on":
            if mapping.note_number is None:
                return False
            return self.send_note_on(
                mapping.channel, mapping.note_number, mapping.note_velocity
            )
        if action == "note_off":
            if mapping.note_number is None:
                return False
            return self.send_note_off(mapping.channel, mapping.note_number)
        return False

    def test_mapping(self, mapping: Mapping, value: int | None = None) -> dict[str, Any]:
        if not self.ensure_connected():
            return {"ok": False, "error": self._last_error or "MIDI not connected"}

        if mapping.midi_type == "cc":
            v = 100 if value is None else value
            ok = self.send_cc(mapping.channel, mapping.cc_number or 0, v)
            return {"ok": ok, "sent": {"type": "cc", "channel": mapping.channel, "cc": mapping.cc_number, "value": v}}

        note = mapping.note_number or 60
        vel = mapping.note_velocity
        ok_on = self.send_note_on(mapping.channel, note, vel)
        time.sleep(0.15)
        ok_off = self.send_note_off(mapping.channel, note)
        return {
            "ok": ok_on and ok_off,
            "sent": {"type": "note", "channel": mapping.channel, "note": note, "velocity": vel},
        }

    def _send(self, msg: mido.Message) -> bool:
        if not self.ensure_connected() or self._port is None:
            return False

        # Non-blocking rate limit — drop rather than stall the async loop
        now = time.monotonic()
        min_gap = self.rate_limit_ms / 1000.0
        if now - self._last_send_at < min_gap and msg.type == "control_change":
            return True

        try:
            self._port.send(msg)
            self._last_send_at = time.monotonic()
            self._last_message_at = time.time()
            self._messages_sent += 1
            return True
        except Exception as exc:
            self._last_error = str(exc)
            self._connected = False
            logger.warning("MIDI send failed: %s — will reconnect", exc)
            self.close()
            return False
