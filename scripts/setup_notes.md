# AtmosMIDI Setup Notes

## Virtual MIDI Port

AtmosMIDI creates a virtual MIDI output named **AtmosMIDI** via `python-rtmidi`.

### If the port does not appear

1. Open **Audio MIDI Setup** (`/Applications/Utilities/Audio MIDI Setup.app`)
2. Window → **Show MIDI Studio**
3. Double-click **IAC Driver**
4. Check **Device is online**
5. Optionally rename a bus or add ports; AtmosMIDI will prefer its own virtual port, and fall back to an IAC bus if needed

### Ableton Live

1. Preferences → **Link, Tempo & MIDI** (or **Link/MIDI**)
2. Find **AtmosMIDI** under MIDI Ports
3. Enable **Track** and **Remote** (Input)
4. Map parameters with MIDI Map Mode (`Cmd+M`) or route CCs on a MIDI track to macros / Max devices / external instruments

## Running

```bash
# Backend (from project root)
uv sync
uv run python main.py

# Frontend (dev)
cd frontend
npm install
npm run dev
```

- API / UI (production build): http://127.0.0.1:8742
- Vite dev UI: http://127.0.0.1:5173 (proxies API)

## Default location

Frederick / Reisterstown, MD area (`39.4143, -77.4105`). Change under Settings in the UI.
