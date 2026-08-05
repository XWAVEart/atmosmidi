import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet'
import { Crosshair, LocateFixed, Search, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import type { AppSettings, WeatherCurrent } from '../lib/types'
import 'leaflet/dist/leaflet.css'

interface Props {
  weather: WeatherCurrent | null
  onSaved: () => void
}

interface GeoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

const PRESETS: { label: string; lat: number; lon: number }[] = [
  { label: 'Frederick, MD', lat: 39.4143, lon: -77.4105 },
  { label: 'New York', lat: 40.7128, lon: -74.006 },
  { label: 'Reykjavík', lat: 64.1466, lon: -21.9426 },
  { label: 'London', lat: 51.5074, lon: -0.1278 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { label: 'São Paulo', lat: -23.5505, lon: -46.6333 },
  { label: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { label: 'Sydney', lat: -33.8688, lon: 151.2093 },
]

export function LocationPage({ weather, onSaved }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draftLat, setDraftLat] = useState(39.4143)
  const [draftLon, setDraftLon] = useState(-77.4105)
  const [draftLabel, setDraftLabel] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.settings().then((s) => {
      setSettings(s)
      setDraftLat(s.latitude)
      setDraftLon(s.longitude)
      setDraftLabel(s.location_label)
    })
  }, [])

  const dirty = useMemo(() => {
    if (!settings) return false
    return (
      Math.abs(settings.latitude - draftLat) > 1e-5 ||
      Math.abs(settings.longitude - draftLon) > 1e-5 ||
      settings.location_label !== draftLabel
    )
  }, [settings, draftLat, draftLon, draftLabel])

  const setPoint = (lat: number, lon: number, label?: string) => {
    setDraftLat(Number(lat.toFixed(4)))
    setDraftLon(Number(lon.toFixed(4)))
    if (label) setDraftLabel(label)
  }

  const search = async () => {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    setMessage(null)
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.results || [])
      if (!data.results?.length) setMessage('No places found')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const apply = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    try {
      const saved = await api.updateSettings({
        ...settings,
        latitude: draftLat,
        longitude: draftLon,
        location_label: draftLabel || `${draftLat.toFixed(2)}, ${draftLon.toFixed(2)}`,
      })
      setSettings(saved)
      setDraftLabel(saved.location_label)
      setMessage('Location applied — fetching weather…')
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return <div className="text-sm text-[var(--color-muted)]">Loading map…</div>
  }

  const activeLat = weather?.latitude ?? settings.latitude
  const activeLon = weather?.longitude ?? settings.longitude

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-cyan-dim)]">
            Source
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white">
            Location
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Click the map or search a place. Weather and MIDI will follow the selected coordinates.
          </p>
        </div>
        <button
          onClick={apply}
          disabled={!dirty || saving}
          className="rounded-md border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/15 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)] disabled:opacity-40"
        >
          {saving ? 'Applying…' : dirty ? 'Apply Location' : 'Location Active'}
        </button>
      </section>

      {message && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-muted)]">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Search city…"
                className="w-full rounded-md border border-[var(--color-line)] bg-black/35 py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-cyan)]/50"
              />
            </div>
            <button
              onClick={search}
              disabled={searching}
              className="w-full rounded-md border border-[var(--color-line)] py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)] hover:text-white"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
            {results.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ')
                        setPoint(r.latitude, r.longitude, label)
                        setResults([])
                        setQuery(r.name)
                      }}
                      className="w-full rounded-md px-2 py-2 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
                    >
                      <span className="text-white">{r.name}</span>
                      <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                        {[r.admin1, r.country].filter(Boolean).join(', ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Label
              </span>
              <input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                className="w-full rounded-md border border-[var(--color-line)] bg-black/35 px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]/50"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Lat
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={draftLat}
                  onChange={(e) => setDraftLat(Number(e.target.value))}
                  className="w-full rounded-md border border-[var(--color-line)] bg-black/35 px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]/50"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Lon
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={draftLon}
                  onChange={(e) => setDraftLon(Number(e.target.value))}
                  className="w-full rounded-md border border-[var(--color-line)] bg-black/35 px-3 py-2 text-sm outline-none focus:border-[var(--color-cyan)]/50"
                />
              </label>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-[var(--color-muted)]">
              <LocateFixed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-cyan)]" />
              <span>
                Active feed: {settings.location_label}
                <br />
                {activeLat.toFixed(3)}, {activeLon.toFixed(3)}
                {weather?.values.temperature_2m != null && (
                  <>
                    {' '}
                    · {weather.values.temperature_2m.toFixed(1)}
                    {/f/i.test(weather.units?.temperature_2m || '') ? '°F' : '°C'}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Quick picks
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPoint(p.lat, p.lon, p.label)}
                  className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)] hover:border-[var(--color-cyan)]/40 hover:text-[var(--color-cyan)]"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)]">
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[rgba(5,7,12,0.85)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] backdrop-blur">
            <Crosshair className="h-3.5 w-3.5 text-[var(--color-cyan)]" />
            Click to set pin
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[rgba(5,7,12,0.85)] px-3 py-1.5 text-xs text-white backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-[var(--color-cyan)]" />
            {draftLabel || 'Unnamed'} · {draftLat.toFixed(3)}, {draftLon.toFixed(3)}
          </div>
          <MapContainer
            center={[draftLat, draftLon]}
            zoom={3}
            minZoom={2}
            maxBounds={[
              [-85, -180],
              [85, 180],
            ]}
            className="h-[520px] w-full md:h-[640px]"
            style={{ background: '#05070c' }}
            worldCopyJump
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapClickHandler onPick={(lat, lon) => setPoint(lat, lon)} />
            <Recenter lat={draftLat} lon={draftLon} />
            <CircleMarker
              center={[draftLat, draftLon]}
              radius={9}
              pathOptions={{
                color: '#3de0ff',
                fillColor: '#3de0ff',
                fillOpacity: 0.85,
                weight: 2,
              }}
            />
            {!dirty && (
              <CircleMarker
                center={[settings.latitude, settings.longitude]}
                radius={16}
                pathOptions={{
                  color: '#8b6cff',
                  fillOpacity: 0,
                  weight: 1,
                  opacity: 0.55,
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    const current = map.getCenter()
    const dist =
      Math.abs(current.lat - lat) + Math.abs(current.lng - lon)
    // Pan when jumping via search/presets; ignore tiny click nudges at high zoom
    if (dist > 0.35 || map.getZoom() < 4) {
      map.flyTo([lat, lon], Math.max(map.getZoom(), 5), { duration: 0.85 })
    }
  }, [lat, lon, map])
  return null
}
