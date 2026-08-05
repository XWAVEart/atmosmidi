"""Application paths and constants."""

from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
MAPPINGS_PATH = DATA_DIR / "mappings.json"
SETTINGS_PATH = DATA_DIR / "settings.json"
LOG_DIR = DATA_DIR / "logs"
LOG_PATH = LOG_DIR / "atmosmidi.log"

MIDI_PORT_NAME = "AtmosMIDI"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8742

# Frederick / Reisterstown, MD area
DEFAULT_LATITUDE = 39.4143
DEFAULT_LONGITUDE = -77.4105
DEFAULT_POLL_INTERVAL = 60.0

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

CURRENT_VARIABLES = [
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
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "is_day",
]

HOURLY_VARIABLES = [
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
    "wind_speed_120m",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "is_day",
    "shortwave_radiation",
    "direct_radiation",
    "diffuse_radiation",
    "uv_index",
]
