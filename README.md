# AtmosMIDI

**Weather → MIDI Generative Engine for Ableton Live**

A long-running macOS application that continuously pulls real-time and forecast weather data, converts it into musical control signals, and streams MIDI (CC + notes) into Ableton Live via a virtual MIDI port named **AtmosMIDI**. Includes a dark, instrument-like local Web UI for live mapping, scaling, monitoring, and control.

## Requirements

- macOS
- Python 3.11+
- Node.js 18+ (for UI development / build)
- Ableton Live (to receive MIDI)

## Quick Start

```bash
# Install Python dependencies
uv sync

# Install & build frontend
cd frontend && npm install && npm run build && cd ..

# Run (serves API + built UI)
uv run python main.py
```

Open **http://127.0.0.1:8742**

### Development (hot-reload UI)

```bash
# Terminal 1 — API
uv run python main.py

# Terminal 2 — Vite
cd frontend && npm run dev
```

UI: http://127.0.0.1:5173 · API: http://127.0.0.1:8742

## Ableton Setup

1. Launch AtmosMIDI — it creates a virtual MIDI port named **AtmosMIDI**
2. In Ableton: **Preferences → Link/MIDI**
3. Enable **Track** and **Remote** for the AtmosMIDI input
4. Use MIDI Map Mode (`Cmd+M`) to assign CCs to macros / parameters

If the port does not appear, enable the **IAC Driver** in Audio MIDI Setup. See [`scripts/setup_notes.md`](scripts/setup_notes.md).

## Default Mappings

| Source | CC | Typical use |
|--------|-----|-------------|
| Temperature | 1 | Mod wheel / macro |
| Humidity | 71 | Resonance / filter |
| Wind Speed | 16 | LFO rate |
| Wind Gusts | 17 | Density / bursts |
| Pressure | 74 | Brightness / reverb |
| Cloud Cover | 18 | Voice density |
| Precipitation | 19 | Noise layer |
| Storminess (derived) | 11 | Master intensity |

All mappings are editable in the Web UI without restarting.

## Architecture

```
Open-Meteo → Weather Service → Signal Processor → MIDI Engine → Ableton
                                      ↕
                         FastAPI + WebSocket ↔ React UI
```

## Configuration

Settings and mappings persist as JSON in `data/`:

- `data/settings.json` — location, poll interval, generative controls
- `data/mappings.json` — full mapping list

Default location: Frederick / Reisterstown, MD (`39.4143, -77.4105`).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | System health |
| GET | `/api/weather/current` | Current + derived signals |
| GET | `/api/weather/raw` | Raw Open-Meteo payload |
| GET/POST | `/api/mappings` | List / create |
| PUT/DELETE | `/api/mappings/{id}` | Update / delete |
| POST | `/api/mappings/{id}/test` | Send a test MIDI message |
| GET/PUT | `/api/settings` | App settings |
| GET/POST | `/api/presets/export` · `/import` | Preset JSON |
| WS | `/ws/live` | Live signal stream |

## Design Rules

1. Prefer continuous CCs for most weather variables
2. Always interpolate and smooth — never send raw stepped values
3. Every mapping is independently enableable and fully scalable from the UI
4. MIDI engine reliability beats weather freshness
5. UI should feel like a professional instrument
