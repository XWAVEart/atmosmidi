import { SignalMeter } from '../components/SignalMeter'
import type { Mapping, MappingLiveState, SystemStatus, WeatherCurrent } from '../lib/types'
import { api } from '../lib/api'

interface Props {
  status: SystemStatus | null
  weather: WeatherCurrent | null
  signals: Record<string, number>
  mappings: Mapping[]
  mappingLive: Record<string, MappingLiveState>
  onSettingsChange: () => void
}

export function Dashboard({
  status,
  weather,
  signals,
  mappings,
  mappingLive,
  onSettingsChange,
}: Props) {
  const values = weather?.values || {}
  const derived = weather?.derived || {}
  const tempUnitRaw = weather?.units?.temperature_2m || '°C'
  const isF = /f/i.test(tempUnitRaw)
  const tempUnit = isF ? '°F' : '°C'
  const tempMin = isF ? 14 : -10
  const tempMax = isF ? 104 : 40

  const toggleGlobal = async () => {
    if (!status) return
    const settings = await api.settings()
    await api.updateSettings({ ...settings, global_enabled: !settings.global_enabled })
    onSettingsChange()
  }

  const setTempUnit = async (unit: 'celsius' | 'fahrenheit') => {
    const settings = await api.settings()
    if (settings.temperature_unit === unit) return
    await api.updateSettings({ ...settings, temperature_unit: unit })
    onSettingsChange()
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-cyan-dim)]">
            Live Monitor
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white md:text-4xl">
            Atmospheric Control
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Real-time weather signals smoothed into MIDI for Ableton Live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-1">
            <button
              type="button"
              onClick={() => setTempUnit('celsius')}
              className={[
                'rounded px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]',
                !isF ? 'bg-[var(--color-panel-2)] text-[var(--color-cyan)]' : 'text-[var(--color-muted)]',
              ].join(' ')}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setTempUnit('fahrenheit')}
              className={[
                'rounded px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]',
                isF ? 'bg-[var(--color-panel-2)] text-[var(--color-cyan)]' : 'text-[var(--color-muted)]',
              ].join(' ')}
            >
              °F
            </button>
          </div>
          <button
            onClick={toggleGlobal}
            className={[
              'rounded-md border px-4 py-2 text-xs uppercase tracking-[0.2em] transition',
              status?.global_enabled
                ? 'border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 text-[var(--color-ok)]'
                : 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
            ].join(' ')}
          >
            Output {status?.global_enabled ? 'Enabled' : 'Muted'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MIDI Port"
          value={status?.midi.connected ? status.midi.port_name : 'Offline'}
          ok={!!status?.midi.connected}
        />
        <Stat
          label="Last Poll"
          value={
            status?.weather.last_success_at
              ? new Date(status.weather.last_success_at).toLocaleTimeString()
              : '—'
          }
          ok={!status?.weather.last_error}
        />
        <Stat
          label="Mappings"
          value={`${status?.enabled_mapping_count ?? 0} / ${status?.mapping_count ?? 0}`}
          ok
        />
        <Stat
          label="MIDI Sent"
          value={String(status?.midi.messages_sent ?? 0)}
          ok
        />
      </section>

      {status?.weather.last_error && (
        <div className="rounded-md border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 px-4 py-3 text-sm text-[var(--color-warn)]">
          Weather: {status.weather.last_error}
          {status.weather.using_cache ? ' — using cached values' : ''}
        </div>
      )}

      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg text-white">
          Conditions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SignalMeter
            label="Temperature"
            value={values.temperature_2m}
            unit={tempUnit}
            min={tempMin}
            max={tempMax}
          />
          <SignalMeter label="Humidity" value={values.relative_humidity_2m} unit="%" />
          <SignalMeter label="Wind" value={values.wind_speed_10m} unit="km/h" max={80} accent="var(--color-blue)" />
          <SignalMeter label="Gusts" value={values.wind_gusts_10m} unit="km/h" max={100} accent="var(--color-violet)" />
          <SignalMeter label="Pressure" value={values.pressure_msl} unit="hPa" min={980} max={1040} />
          <SignalMeter label="Cloud Cover" value={values.cloud_cover} unit="%" accent="var(--color-violet)" />
          <SignalMeter label="Precipitation" value={values.precipitation} unit="mm" max={5} accent="var(--color-blue)" />
          <SignalMeter
            label="Storminess"
            value={derived.storminess ?? signals['derived.storminess'] ?? signals.storminess}
            unit=""
            accent="var(--color-danger)"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg text-white">
          Active MIDI Streams
        </h3>
        <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-panel)] text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Mapping</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Out</th>
                <th className="px-3 py-2 font-medium">Raw</th>
                <th className="px-3 py-2 font-medium">MIDI</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => {
                const live = mappingLive[m.id]
                return (
                  <tr key={m.id} className="border-t border-[var(--color-line)]/70 bg-[var(--color-ink)]/40">
                    <td className="px-3 py-2 text-white">
                      <span
                        className="mr-2 inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          background: m.enabled ? 'var(--color-ok)' : 'var(--color-muted)',
                        }}
                      />
                      {m.name || m.source}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{m.source}</td>
                    <td className="px-3 py-2 text-[var(--color-cyan)]">
                      {m.midi_type === 'cc'
                        ? `Ch${m.channel} CC${m.cc_number}`
                        : `Ch${m.channel} N${m.note_number}`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {live?.raw_value == null ? '—' : live.raw_value.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full bg-[var(--color-cyan)] transition-all duration-300"
                            style={{ width: `${((live?.midi_value ?? 0) / 127) * 100}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-white">
                          {live?.midi_value ?? '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/60 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</div>
      <div
        className="mt-1 truncate font-[family-name:var(--font-display)] text-lg"
        style={{ color: ok ? 'white' : 'var(--color-warn)' }}
      >
        {value}
      </div>
    </div>
  )
}
