"""MIDI mapping models."""

from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


CurveType = Literal["linear", "exponential", "logarithmic", "s-curve"]
MidiType = Literal["cc", "note"]


class Mapping(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = ""
    source: str
    enabled: bool = True

    midi_type: MidiType = "cc"
    channel: int = 1
    cc_number: int | None = None
    note_number: int | None = None
    note_velocity: int = 100

    input_min: float
    input_max: float
    output_min: int = 0
    output_max: int = 127
    curve: CurveType = "linear"
    invert: bool = False

    smoothing: float = 0.3
    send_only_on_change: bool = True
    change_threshold: float = 0.5

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, value: int) -> int:
        if not 1 <= value <= 16:
            raise ValueError("channel must be between 1 and 16")
        return value

    @field_validator("cc_number", "note_number")
    @classmethod
    def validate_midi_number(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if not 0 <= value <= 127:
            raise ValueError("MIDI number must be between 0 and 127")
        return value

    @field_validator("note_velocity", "output_min", "output_max")
    @classmethod
    def validate_midi_range(cls, value: int) -> int:
        if not 0 <= value <= 127:
            raise ValueError("value must be between 0 and 127")
        return value

    @field_validator("smoothing")
    @classmethod
    def validate_smoothing(cls, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError("smoothing must be between 0 and 1")
        return value

    @model_validator(mode="after")
    def validate_output_type(self) -> Mapping:
        if self.midi_type == "cc" and self.cc_number is None:
            raise ValueError("cc_number is required when midi_type is 'cc'")
        if self.midi_type == "note" and self.note_number is None:
            raise ValueError("note_number is required when midi_type is 'note'")
        if self.input_min == self.input_max:
            raise ValueError("input_min and input_max must differ")
        return self


class MappingCreate(BaseModel):
    name: str = ""
    source: str
    enabled: bool = True
    midi_type: MidiType = "cc"
    channel: int = 1
    cc_number: int | None = None
    note_number: int | None = None
    note_velocity: int = 100
    input_min: float
    input_max: float
    output_min: int = 0
    output_max: int = 127
    curve: CurveType = "linear"
    invert: bool = False
    smoothing: float = 0.3
    send_only_on_change: bool = True
    change_threshold: float = 0.5


class MappingUpdate(BaseModel):
    name: str | None = None
    source: str | None = None
    enabled: bool | None = None
    midi_type: MidiType | None = None
    channel: int | None = None
    cc_number: int | None = None
    note_number: int | None = None
    note_velocity: int | None = None
    input_min: float | None = None
    input_max: float | None = None
    output_min: int | None = None
    output_max: int | None = None
    curve: CurveType | None = None
    invert: bool | None = None
    smoothing: float | None = None
    send_only_on_change: bool | None = None
    change_threshold: float | None = None


class MappingLiveState(BaseModel):
    id: str
    source: str
    enabled: bool
    raw_value: float | None = None
    smoothed_value: float | None = None
    midi_value: int | None = None
    last_sent: int | None = None
