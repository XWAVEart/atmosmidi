# AtmosMIDI

**Weather → MIDI Generative Engine for Ableton Live**

AtmosMIDI is a long-running macOS app that pulls live weather data, turns it into musical control signals, and streams MIDI (continuous CCs and occasional notes) into Ableton Live through a virtual port named **AtmosMIDI**.

It is built for **24/7 generative / atmospheric music** — an always-on weather personality that evolves over hours — not primarily as a live performance controller.

A local Web UI lets you monitor signals, pick a location on a world map, edit mappings, scale curves, toggle °C/°F, and tune generative motion without restarting the process.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Requirements](#requirements)
3. [Quick start](#quick-start)
4. [Ableton & MIDI setup](#ableton--midi-setup)
5. [Web UI](#web-ui)
6. [How the signal pipeline works](#how-the-signal-pipeline-works)
7. [Update rates & timing](#update-rates--timing)
8. [Weather data](#weather-data)
9. [Derived signals](#derived-signals)
10. [MIDI mappings](#midi-mappings)
11. [Generative layers](#generative-layers)
12. [Settings & persistence](#settings--persistence)
13. [HTTP & WebSocket API](#http--websocket-api)
14. [Project structure](#project-structure)
15. [Design rules](#design-rules)
16. [Reliability](#reliability)
17. [Troubleshooting](#troubleshooting)
18. [Development](#development)

---

## What it does

```
Open-Meteo API
      │
      ▼
Weather Service          async poll · cache · backoff
      │
      ▼
Signal Processor         normalize · interpolate · scale · derive · generative
      │
      ▼
MIDI Engine              CC / note · rate limit · virtual port "AtmosMIDI"
      │
      ▼
Ableton Live

FastAPI + WebSocket  ◄──►  React UI (localhost)
```

At a high level:

1. Poll [Open-Meteo](https://open-meteo.com/) for current + hourly weather at a chosen lat/lon
2. Smooth and interpolate values so MIDI never hard-jumps
3. Compute derived metrics (storminess, tendencies, wind shear, etc.)
4. Optionally add light generative motion biased by wind / storminess
5. Map signals → MIDI CC or notes on configurable channels
6. Expose everything in a dark, instrument-like local UI

---

## Requirements

| Dependency | Notes |
|------------|--------|
| **macOS** | Virtual MIDI via `python-rtmidi` / IAC |
| **Python 3.11+** | Backend runtime (`uv` recommended) |
| **Node.js 18+** | Frontend build / dev server |
| **Ableton Live** | Receives the AtmosMIDI port |
| Network | Open-Meteo (no API key for non-commercial use) |

---

## Quick start

```bash
# From the project root
uv sync

cd frontend && npm install && npm run build && cd ..

uv run python main.py
# or: ./scripts/run.sh
```

Open **http://127.0.0.1:8742**

The backend serves the API, WebSocket, and the built React UI from one process (default bind: `127.0.0.1:8742`).

### Development (hot-reload UI)

```bash
# Terminal 1 — API
uv run python main.py

# Terminal 2 — Vite
cd frontend && npm install && npm run dev
```

| Service | URL |
|---------|-----|
| Production UI + API | http://127.0.0.1:8742 |
| Vite dev UI | http://127.0.0.1:5173 (proxies `/api` and `/ws`) |

CLI options:

```bash
uv run python main.py --host 127.0.0.1 --port 8742 -v
```

---

## Ableton & MIDI setup

### Virtual port

On launch, AtmosMIDI opens a **virtual MIDI output** named `AtmosMIDI` (`mido` + `python-rtmidi`).

If creation fails, it falls back to an existing port whose name contains `AtmosMIDI`, then to an **IAC** bus if present.

### Enable IAC (fallback)

1. Open **Audio MIDI Setup** → Window → **Show MIDI Studio**
2. Double-click **IAC Driver**
3. Check **Device is online**

More detail: [`scripts/setup_notes.md`](scripts/setup_notes.md).

### Ableton Live

1. Start AtmosMIDI first so the port exists
2. **Preferences → Link, Tempo & MIDI** (or **Link/MIDI**)
3. Under MIDI Ports, find **AtmosMIDI**
4. Enable **Track** and **Remote** on the input
5. Map with MIDI Map Mode (`Cmd+M`), or route CCs on a MIDI track to macros / Max devices / external instruments

---

## Web UI

Dark, near-black UI with cyan / blue accents. Four main tabs:

### Monitor

- Live meters for key conditions (temperature, humidity, wind, pressure, clouds, precip, storminess)
- **°C / °F** toggle (applies immediately)
- Global MIDI **Output Enabled / Muted**
- System status: MIDI port, last poll, mapping counts, messages sent
- Table of active mappings with live raw → MIDI values

### Location

- Interactive dark world map (Leaflet + CARTO tiles)
- Click anywhere to set a pin
- City search via Open-Meteo geocoding
- Quick picks (Frederick MD, NYC, Reykjavík, London, Tokyo, etc.)
- Manual lat/lon + label
- **Apply Location** saves settings and wakes an immediate weather fetch

Default location: **Frederick / Reisterstown, MD** (`39.4143, -77.4105`).

### Mappings

Full editor for every mapping:

- Source signal (weather, `derived.*`, or `generative.*`)
- Enable / disable, duplicate, delete, **Test** (fires MIDI once)
- MIDI type: **CC** or **Note** (channel, CC/note number, velocity)
- Input range, output range (0–127), curve, invert
- Smoothing, send-only-on-change, change threshold
- Live curve preview with current value marker

Changes save through the API and take effect without restarting.

### Settings

- Location label, lat/lon, poll interval (15–600 s)
- **Temperature unit** (°C / °F)
- MIDI port name, rate limit
- Global enable + global intensity
- Generative layers (see below)
- Preset **export / import** (JSON: settings + mappings)

---

## How the signal pipeline works

1. **Fetch** — Open-Meteo current + nearest hourly sample; cache last good response
2. **Ingest** — New values become *targets*; the processor never snaps to them
3. **Tick (20 Hz)** — Smoothed values ease toward targets; generative LFOs advance
4. **Map** — Each enabled mapping: resolve source → per-mapping smoothing → optional generative wobble → curve/scale → MIDI integer
5. **Send** — CC on change (threshold) or note on/off at mid-threshold crossings; rate-limited

MIDI reliability is prioritized over weather freshness: if the network fails, last values keep driving output.

---

## Update rates & timing

| Layer | Default | Notes |
|-------|---------|--------|
| Weather poll | **60 s** | Configurable 15–600 s in Settings |
| Location / unit change | **Immediate** | Wakes the poller instead of waiting |
| Engine tick | **20 Hz** (~50 ms) | Interpolation + MIDI evaluation |
| MIDI CC rate limit | **20 ms** | Drops excess CCs rather than blocking the async loop |
| Mapping smoothing | 0–1 per mapping | Higher = slower response to weather |

The UI and MIDI feel continuous because of interpolation. The underlying Open-Meteo snapshot only refreshes on the poll interval (unless you change location or temperature unit).

---

## Weather data

### Source

[Open-Meteo Forecast API](https://open-meteo.com/) — no API key required for non-commercial use.

Requested units:

- Temperature: `celsius` or `fahrenheit` (from settings)
- Wind: km/h
- Precipitation: mm

### Core variables

Current and/or hourly fields include:

| Variable | Typical meaning |
|----------|-----------------|
| `temperature_2m` | Air temperature |
| `apparent_temperature` | Feels-like |
| `relative_humidity_2m` | Humidity % |
| `dew_point_2m` | Dew point |
| `pressure_msl` / `surface_pressure` | Pressure |
| `cloud_cover` (+ low/mid/high) | Cloud % |
| `visibility` | Visibility |
| `wind_speed_10m` / `wind_direction_10m` / `wind_gusts_10m` | Wind |
| `wind_speed_80m` / `wind_speed_120m` | Higher-level wind (shear) |
| `precipitation` / `rain` / `showers` / `snowfall` | Moisture |
| `weather_code` / `is_day` | Condition / day flag |
| `shortwave_radiation` / `direct_radiation` / `uv_index` | Radiation / UV |

On failure: exponential backoff, keep last cache, continue MIDI from smoothed values.

---

## Derived signals

Computed in the processor and available as mapping sources with a `derived.` prefix (also exposed without the prefix in some payloads):

| Source | Description |
|--------|-------------|
| `derived.temp_tendency` | Temperature rate of change |
| `derived.pressure_tendency` | Pressure rate of change |
| `derived.wind_tendency` | Wind speed rate of change |
| `derived.humidity_tendency` | Humidity rate of change |
| `derived.wind_shear` | Difference across wind height levels |
| `derived.storminess` | 0–100 activity score (gusts, precip, cloud, shear, pressure drop) |
| `derived.day_night_transition` | Twilight / day-change strength |
| `derived.humidity_temp_interaction` | Muggy / heat–humidity interaction |
| `derived.activity_score` | Blend of storminess, wind, precip |

---

## MIDI mappings

### Model

Each mapping roughly matches:

| Field | Role |
|-------|------|
| `source` | Weather / derived / generative key |
| `enabled` | Per-mapping mute |
| `midi_type` | `cc` or `note` |
| `channel` | 1–16 |
| `cc_number` / `note_number` | 0–127 |
| `input_min` / `input_max` | Physical range of the source |
| `output_min` / `output_max` | MIDI range (usually 0–127) |
| `curve` | `linear` · `exponential` · `logarithmic` · `s-curve` |
| `invert` | Flip low/high |
| `smoothing` | 0–1 lag |
| `send_only_on_change` | Skip unchanged CCs |
| `change_threshold` | Minimum CC delta to send |

**CC behavior:** scale continuously; send when value changes enough.  
**Note behavior:** note-on when the smoothed value crosses the mid-point of the input range upward; note-off when it falls back below.

### Default mappings (shipped)

| Name | Source | Default out | Typical use |
|------|--------|-------------|-------------|
| Temperature → Mod Wheel | `temperature_2m` | Ch1 CC1 | Mod / macro |
| Humidity → Resonance | `relative_humidity_2m` | Ch1 CC71 | Filter resonance |
| Wind Speed → LFO Rate | `wind_speed_10m` | Ch1 CC16 | LFO / motion rate |
| Wind Gusts → Density | `wind_gusts_10m` | Ch1 CC17 | Bursts / density |
| Pressure → Brightness | `pressure_msl` | Ch1 CC74 | Brightness / reverb |
| Cloud Cover → Voice Density | `cloud_cover` | Ch1 CC18 | Layer density |
| Precipitation → Noise Layer | `precipitation` | Ch1 CC19 | Noise / texture |
| Storminess → Master Intensity | `derived.storminess` | Ch1 CC11 | Master intensity |

All of these are editable, duplicable, and replaceable in the UI.

### Temperature unit & mappings

Toggling **°C ↔ °F**:

1. Sets Open-Meteo `temperature_unit`
2. Refetches weather immediately
3. Converts `input_min` / `input_max` on mappings whose source is `temperature_2m`, `apparent_temperature`, or `dew_point_2m`

So MIDI scaling stays musically consistent across unit changes.

---

## Generative layers

Weather alone can feel static between polls. Generative layers add **light, weather-biased motion** so the stream keeps breathing.

Controlled in **Settings → Generative Layers** (and as mappable sources).

| Control | Effect |
|---------|--------|
| **Enable generative motion** | Master on/off |
| **Motion Depth** | Strength of slow LFO-style wobble on CC mappings; scales `generative.motion` / `pulse` / `drift` |
| **Chaos** | Extra irregular secondary oscillator |
| **Event Probability** | Chance of short random spikes (`generative.event` → 1 briefly); higher when storminess is up |

Behavior details:

- LFO rate increases with **wind speed** and **storminess**
- Enabled CC mappings get a small per-mapping phase-offset wobble (`motion_depth × ~8%` of input span)
- You can map these sources directly:
  - `generative.motion`
  - `generative.pulse`
  - `generative.event`
  - `generative.drift`

Turn generative **off** for a purely data-driven, documentary weather → MIDI feed.

---

## Settings & persistence

Stored as JSON under `data/` (created automatically):

| File | Contents |
|------|----------|
| `data/settings.json` | Location, poll interval, temperature unit, MIDI, generative, intensity |
| `data/mappings.json` | Full mapping list |
| `data/logs/atmosmidi.log` | Rotating application logs |

### Important settings

| Key | Default | Description |
|-----|---------|-------------|
| `latitude` / `longitude` | 39.4143 / -77.4105 | Weather coordinates |
| `location_label` | Frederick / Reisterstown, MD | Display name |
| `poll_interval` | 60 | Seconds between fetches (min 15) |
| `temperature_unit` | `celsius` | `celsius` or `fahrenheit` |
| `midi_port_name` | `AtmosMIDI` | Virtual port name |
| `midi_rate_limit_ms` | 20 | Min gap between CC sends |
| `global_enabled` | true | Master MIDI mute |
| `global_intensity` | 1.0 | Scales mapped output around mid-range (0–2) |
| `generative_*` | see above | Generative layer controls |

Presets: **Settings → Export / Import JSON** bundles settings + mappings.

---

## HTTP & WebSocket API

Base URL: `http://127.0.0.1:8742`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Running state, weather health, MIDI health, mapping counts, uptime |
| `GET` | `/api/weather/current` | Normalized values, units, derived, signals |
| `GET` | `/api/weather/raw` | Raw Open-Meteo JSON |
| `GET` | `/api/sources` | List of mappable source keys |
| `GET` | `/api/mappings` | All mappings |
| `POST` | `/api/mappings` | Create mapping |
| `PUT` | `/api/mappings/{id}` | Update mapping |
| `DELETE` | `/api/mappings/{id}` | Delete mapping |
| `POST` | `/api/mappings/{id}/duplicate` | Duplicate mapping |
| `POST` | `/api/mappings/{id}/test` | Send a test MIDI message |
| `GET` | `/api/settings` | Current settings |
| `PUT` | `/api/settings` | Update settings (location/unit changes trigger refresh) |
| `GET` | `/api/presets/export` | Export settings + mappings |
| `POST` | `/api/presets/import` | Import preset JSON |
| `WS` | `/ws/live` | Live stream: `status`, `weather`, `mappings`, `live`, `ping` |

All request/response bodies are validated with Pydantic.

Example:

```bash
curl -s http://127.0.0.1:8742/api/status | python3 -m json.tool
curl -s http://127.0.0.1:8742/api/weather/current | python3 -m json.tool
```

---

## Project structure

```
atmosmidi/
├── README.md
├── pyproject.toml              # Python deps (uv / hatchling)
├── main.py                     # Entry point (uvicorn)
├── config.py                   # Paths, defaults, Open-Meteo field lists
├── models/
│   ├── mapping.py              # Mapping Pydantic models
│   ├── weather.py
│   └── settings.py
├── services/
│   ├── weather_fetcher.py      # Open-Meteo poll + cache + wake
│   ├── processor.py            # Smooth, scale, derive
│   ├── generative.py           # Weather-biased motion
│   ├── midi_engine.py          # Virtual port + send
│   ├── store.py                # JSON persistence
│   └── engine.py               # Orchestrates the runtime loop
├── api/
│   ├── main.py                 # FastAPI app + static UI
│   ├── websocket.py
│   └── routes/                 # status, mappings, settings
├── frontend/                   # React + Vite + Tailwind
│   └── src/
│       ├── pages/              # Monitor, Location, Mappings, Settings
│       ├── components/
│       ├── hooks/useLive.ts    # WebSocket client
│       └── lib/
├── data/                       # settings.json, mappings.json, logs/
└── scripts/
    ├── run.sh
    └── setup_notes.md
```

---

## Design rules

1. Prefer continuous **CCs** for most weather variables; notes for threshold events
2. Always **interpolate and smooth** — never send raw stepped API values
3. Every mapping is independently enableable and fully scalable from the UI
4. **MIDI reliability > weather freshness** — keep sounding on network failure
5. UI should feel like a professional instrument, not a debug console
6. Code stays typed (Pydantic + type hints) and modular for easy iteration
7. Default location and units are easy to change
8. Keep the system understandable so an agent (or human) can extend it cleanly

---

## Reliability

- Single long-running Python process
- Network failures do not stop MIDI (cached weather + smoothed values)
- MIDI port auto-reopen on send failure
- Rotating file logs in `data/logs/`
- Low CPU intent: send MIDI only when values change meaningfully
- Location / temperature-unit changes interrupt the poll sleep for a fast refresh

### Success criteria

- Runs for days without crashing or significant memory growth
- Ableton receives smooth, musically useful CC streams
- Mappings reconfigurable from the browser without restart
- Visual feedback is immediate
- Output has a recognizable “weather personality” that evolves over hours

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| No MIDI in Ableton | Confirm AtmosMIDI is running; enable Track + Remote for the port; try MIDI Map Mode |
| Port missing | Restart AtmosMIDI; enable IAC Driver in Audio MIDI Setup |
| Weather stuck / error banner | Check network; wait for backoff; confirm lat/lon; watch `data/logs/atmosmidi.log` |
| UI not updating | Hard-refresh; confirm server on `:8742`; check WS indicator in the header |
| Temperature ranges feel wrong after °C/°F | Remap input min/max on that mapping; unit toggle auto-converts temp sources only |
| Too static | Raise generative motion depth / chaos, or lower mapping smoothing |
| Too twitchy | Raise smoothing and change threshold; lower generative depth; increase poll interval |

Header status dots:

- **WS** — WebSocket connected
- **MIDI** — Virtual port open
- **OUT** — Global output enabled

---

## Development

```bash
uv sync
uv run python main.py -v          # verbose logs

cd frontend
npm install
npm run dev                       # http://127.0.0.1:5173
npm run build                     # emits frontend/dist for production serve
```

Stack:

| Layer | Choice |
|-------|--------|
| Language | Python 3.11+ |
| Backend | FastAPI + Uvicorn |
| Async | asyncio |
| MIDI | mido + python-rtmidi |
| Frontend | React + Vite + Tailwind |
| Maps | Leaflet + react-leaflet |
| Config | Pydantic + JSON files |

---

## License / data attribution

Weather data © [Open-Meteo](https://open-meteo.com/). Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) / [CARTO](https://carto.com/).

This project is intended for local, creative, non-commercial weather-driven music systems unless you comply with Open-Meteo’s terms for your use case.
