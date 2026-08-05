import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { AppSettings, SystemStatus } from '../lib/types'

interface Props {
  status: SystemStatus | null
  onSaved: () => void
}

export function SettingsPage({ status, onSaved }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.settings().then(setSettings).catch((e) => setMessage(String(e)))
  }, [])

  if (!settings) {
    return <div className="text-sm text-[var(--color-muted)]">Loading settings…</div>
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  const save = async () => {
    setSaving(true)
    try {
      const saved = await api.updateSettings(settings)
      setSettings(saved)
      setMessage('Settings saved')
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const exportPresets = async () => {
    const data = await api.exportPresets()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'atmosmidi-preset.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importPresets = async (file: File) => {
    const text = await file.text()
    const json = JSON.parse(text)
    await api.importPresets(json)
    const refreshed = await api.settings()
    setSettings(refreshed)
    setMessage('Preset imported')
    onSaved()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section>
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-cyan-dim)]">
          System
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white">
          Settings
        </h2>
      </section>

      {message && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-muted)]">
          {message}
        </div>
      )}

      <Panel title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label">
            <input
              className="field"
              value={settings.location_label}
              onChange={(e) => set('location_label', e.target.value)}
            />
          </Field>
          <Field label="Poll Interval (seconds)">
            <input
              className="field"
              type="number"
              min={15}
              max={600}
              value={settings.poll_interval}
              onChange={(e) => set('poll_interval', Number(e.target.value))}
            />
          </Field>
          <Field label="Latitude">
            <input
              className="field"
              type="number"
              step="0.0001"
              value={settings.latitude}
              onChange={(e) => set('latitude', Number(e.target.value))}
            />
          </Field>
          <Field label="Longitude">
            <input
              className="field"
              type="number"
              step="0.0001"
              value={settings.longitude}
              onChange={(e) => set('longitude', Number(e.target.value))}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="MIDI">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Port Name">
            <input
              className="field"
              value={settings.midi_port_name}
              onChange={(e) => set('midi_port_name', e.target.value)}
            />
          </Field>
          <Field label="Rate Limit (ms)">
            <input
              className="field"
              type="number"
              min={1}
              max={500}
              value={settings.midi_rate_limit_ms}
              onChange={(e) => set('midi_rate_limit_ms', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-[var(--color-muted)]">
          <div>
            Status:{' '}
            <span className={status?.midi.connected ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'}>
              {status?.midi.connected ? 'Connected' : 'Disconnected'}
            </span>
            {status?.midi.virtual ? ' · virtual port' : ''}
          </div>
          {status?.midi.last_error && (
            <div className="text-[var(--color-warn)]">{status.midi.last_error}</div>
          )}
          {!!status?.midi.available_outputs?.length && (
            <div>Available: {status.midi.available_outputs.join(', ')}</div>
          )}
        </div>
      </Panel>

      <Panel title="Output & Intensity">
        <label className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={settings.global_enabled}
            onChange={(e) => set('global_enabled', e.target.checked)}
          />
          Global MIDI output enabled
        </label>
        <Field label={`Global Intensity ${settings.global_intensity.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={settings.global_intensity}
            onChange={(e) => set('global_intensity', Number(e.target.value))}
            className="w-full accent-[var(--color-cyan)]"
          />
        </Field>
      </Panel>

      <Panel title="Generative Layers">
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.generative_enabled}
            onChange={(e) => set('generative_enabled', e.target.checked)}
          />
          Enable generative motion
        </label>
        <div className="space-y-4">
          <Field label={`Motion Depth ${settings.generative_motion_depth.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.generative_motion_depth}
              onChange={(e) => set('generative_motion_depth', Number(e.target.value))}
              className="w-full accent-[var(--color-violet)]"
            />
          </Field>
          <Field label={`Event Probability ${settings.generative_event_probability.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.generative_event_probability}
              onChange={(e) => set('generative_event_probability', Number(e.target.value))}
              className="w-full accent-[var(--color-violet)]"
            />
          </Field>
          <Field label={`Chaos ${settings.generative_chaos.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.generative_chaos}
              onChange={(e) => set('generative_chaos', Number(e.target.value))}
              className="w-full accent-[var(--color-violet)]"
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Presets">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportPresets}
            className="rounded-md border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-wider text-[var(--color-text)]"
          >
            Export JSON
          </button>
          <label className="cursor-pointer rounded-md border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-wider text-[var(--color-text)]">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importPresets(file).catch((err) => setMessage(String(err)))
              }}
            />
          </label>
        </div>
      </Panel>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/15 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid var(--color-line);
          background: rgba(0,0,0,0.35);
          padding: 0.5rem 0.75rem;
          color: white;
          outline: none;
        }
        .field:focus { border-color: rgba(61,224,255,0.45); }
      `}</style>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/50 p-5">
      <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg text-white">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}
