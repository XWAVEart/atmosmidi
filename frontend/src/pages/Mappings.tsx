import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Plus, Search, TestTube2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { CurvePreview } from '../components/CurvePreview'
import type { CurveType, Mapping, MappingLiveState, MidiType } from '../lib/types'

interface Props {
  mappings: Mapping[]
  mappingLive: Record<string, MappingLiveState>
  onChange: (mappings: Mapping[]) => void
}

const CURVES: CurveType[] = ['linear', 'exponential', 'logarithmic', 's-curve']

export function MappingsPage({ mappings, mappingLive, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(mappings[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.sources().then((r) => setSources(r.sources)).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedId && mappings[0]) setSelectedId(mappings[0].id)
    if (selectedId && !mappings.find((m) => m.id === selectedId)) {
      setSelectedId(mappings[0]?.id ?? null)
    }
  }, [mappings, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return mappings
    return mappings.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q) ||
        String(m.cc_number ?? '').includes(q),
    )
  }, [mappings, query])

  const selected = mappings.find((m) => m.id === selectedId) || null
  const live = selected ? mappingLive[selected.id] : null

  const patch = async (id: string, body: Partial<Mapping>) => {
    setBusy(true)
    try {
      const updated = await api.updateMapping(id, body)
      onChange(mappings.map((m) => (m.id === id ? updated : m)))
      setMessage(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const addMapping = async () => {
    setBusy(true)
    try {
      const created = await api.createMapping({
        name: 'New Mapping',
        source: 'temperature_2m',
        enabled: true,
        midi_type: 'cc',
        channel: 1,
        cc_number: 20,
        input_min: 0,
        input_max: 100,
        output_min: 0,
        output_max: 127,
        curve: 'linear',
        smoothing: 0.3,
      })
      onChange([...mappings, created])
      setSelectedId(created.id)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (id: string) => {
    const copy = await api.duplicateMapping(id)
    onChange([...mappings, copy])
    setSelectedId(copy.id)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this mapping?')) return
    await api.deleteMapping(id)
    onChange(mappings.filter((m) => m.id !== id))
  }

  const test = async (id: string) => {
    const result = await api.testMapping(id)
    setMessage(result.ok ? 'Test MIDI sent' : result.error || 'Test failed')
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-cyan-dim)]">
            Mapping System
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white">
            Signal → MIDI
          </h2>
        </div>
        <button
          onClick={addMapping}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-cyan)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Mapping
        </button>
      </section>

      {message && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-muted)]">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mappings…"
              className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-cyan)]/50"
            />
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {filtered.map((m) => {
              const l = mappingLive[m.id]
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={[
                    'w-full rounded-lg border px-3 py-3 text-left transition',
                    selectedId === m.id
                      ? 'border-[var(--color-cyan)]/40 bg-[var(--color-panel-2)]'
                      : 'border-[var(--color-line)] bg-[var(--color-panel)]/50 hover:border-[var(--color-line)]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-white">{m.name || m.source}</span>
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: m.enabled ? 'var(--color-ok)' : 'var(--color-muted)' }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    <span>
                      {m.midi_type === 'cc' ? `CC ${m.cc_number}` : `Note ${m.note_number}`}
                    </span>
                    <span className="tabular-nums text-[var(--color-cyan)]">
                      {l?.midi_value ?? '—'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {selected ? (
          <Editor
            mapping={selected}
            live={live ?? undefined}
            sources={sources}
            onPatch={(body) => patch(selected.id, body)}
            onDuplicate={() => duplicate(selected.id)}
            onDelete={() => remove(selected.id)}
            onTest={() => test(selected.id)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--color-line)] p-10 text-center text-sm text-[var(--color-muted)]">
            Select or create a mapping
          </div>
        )}
      </div>
    </div>
  )
}

function Editor({
  mapping,
  live,
  sources,
  onPatch,
  onDuplicate,
  onDelete,
  onTest,
}: {
  mapping: Mapping
  live?: MappingLiveState
  sources: string[]
  onPatch: (body: Partial<Mapping>) => void
  onDuplicate: () => void
  onDelete: () => void
  onTest: () => void
}) {
  const [draft, setDraft] = useState(mapping)

  useEffect(() => {
    setDraft(mapping)
  }, [mapping])

  const set = <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const commit = (key: keyof Mapping, value: Mapping[keyof Mapping]) => {
    onPatch({ [key]: value })
  }

  return (
    <div className="space-y-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/40 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => commit('name', draft.name)}
            className="w-full border-0 bg-transparent font-[family-name:var(--font-display)] text-2xl text-white outline-none"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Live MIDI: <span className="text-[var(--color-cyan)]">{live?.midi_value ?? '—'}</span>
            {live?.raw_value != null && (
              <span> · raw {live.raw_value.toFixed(2)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onPatch({ enabled: !mapping.enabled })}
            className={[
              'rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-wider',
              mapping.enabled
                ? 'border-[var(--color-ok)]/40 text-[var(--color-ok)]'
                : 'border-[var(--color-line)] text-[var(--color-muted)]',
            ].join(' ')}
          >
            {mapping.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <IconBtn onClick={onTest} title="Test">
            <TestTube2 className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={onDuplicate} title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={onDelete} title="Delete" danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Source">
          <select
            value={draft.source}
            onChange={(e) => {
              set('source', e.target.value)
              commit('source', e.target.value)
            }}
            className="field"
          >
            {[draft.source, ...sources.filter((s) => s !== draft.source)].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="MIDI Type">
          <select
            value={draft.midi_type}
            onChange={(e) => {
              const midi_type = e.target.value as MidiType
              const body: Partial<Mapping> = { midi_type }
              if (midi_type === 'cc' && draft.cc_number == null) body.cc_number = 1
              if (midi_type === 'note' && draft.note_number == null) body.note_number = 60
              setDraft((d) => ({ ...d, ...body }))
              onPatch(body)
            }}
            className="field"
          >
            <option value="cc">CC</option>
            <option value="note">Note</option>
          </select>
        </Field>
        <Field label="Channel (1–16)">
          <input
            type="number"
            min={1}
            max={16}
            value={draft.channel}
            onChange={(e) => set('channel', Number(e.target.value))}
            onBlur={() => commit('channel', draft.channel)}
            className="field"
          />
        </Field>
        {draft.midi_type === 'cc' ? (
          <Field label="CC Number">
            <input
              type="number"
              min={0}
              max={127}
              value={draft.cc_number ?? 0}
              onChange={(e) => set('cc_number', Number(e.target.value))}
              onBlur={() => commit('cc_number', draft.cc_number)}
              className="field"
            />
          </Field>
        ) : (
          <>
            <Field label="Note Number">
              <input
                type="number"
                min={0}
                max={127}
                value={draft.note_number ?? 60}
                onChange={(e) => set('note_number', Number(e.target.value))}
                onBlur={() => commit('note_number', draft.note_number)}
                className="field"
              />
            </Field>
            <Field label="Note Velocity">
              <input
                type="number"
                min={0}
                max={127}
                value={draft.note_velocity}
                onChange={(e) => set('note_velocity', Number(e.target.value))}
                onBlur={() => commit('note_velocity', draft.note_velocity)}
                className="field"
              />
            </Field>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Input Min">
          <input
            type="number"
            value={draft.input_min}
            onChange={(e) => set('input_min', Number(e.target.value))}
            onBlur={() => commit('input_min', draft.input_min)}
            className="field"
          />
        </Field>
        <Field label="Input Max">
          <input
            type="number"
            value={draft.input_max}
            onChange={(e) => set('input_max', Number(e.target.value))}
            onBlur={() => commit('input_max', draft.input_max)}
            className="field"
          />
        </Field>
        <Field label="Output Min">
          <input
            type="number"
            min={0}
            max={127}
            value={draft.output_min}
            onChange={(e) => set('output_min', Number(e.target.value))}
            onBlur={() => commit('output_min', draft.output_min)}
            className="field"
          />
        </Field>
        <Field label="Output Max">
          <input
            type="number"
            min={0}
            max={127}
            value={draft.output_max}
            onChange={(e) => set('output_max', Number(e.target.value))}
            onBlur={() => commit('output_max', draft.output_max)}
            className="field"
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <Field label="Curve">
            <select
              value={draft.curve}
              onChange={(e) => {
                const curve = e.target.value as CurveType
                set('curve', curve)
                commit('curve', curve)
              }}
              className="field"
            >
              {CURVES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Smoothing ${draft.smoothing.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={draft.smoothing}
              onChange={(e) => set('smoothing', Number(e.target.value))}
              onMouseUp={() => commit('smoothing', draft.smoothing)}
              onTouchEnd={() => commit('smoothing', draft.smoothing)}
              className="w-full accent-[var(--color-cyan)]"
            />
          </Field>
          <Field label={`Change Threshold ${draft.change_threshold}`}>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={draft.change_threshold}
              onChange={(e) => set('change_threshold', Number(e.target.value))}
              onMouseUp={() => commit('change_threshold', draft.change_threshold)}
              onTouchEnd={() => commit('change_threshold', draft.change_threshold)}
              className="w-full accent-[var(--color-cyan)]"
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={draft.invert}
              onChange={(e) => {
                set('invert', e.target.checked)
                commit('invert', e.target.checked)
              }}
            />
            Invert
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={draft.send_only_on_change}
              onChange={(e) => {
                set('send_only_on_change', e.target.checked)
                commit('send_only_on_change', e.target.checked)
              }}
            />
            Send only on change
          </label>
        </div>
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Curve Preview
          </p>
          <CurvePreview
            curve={draft.curve}
            invert={draft.invert}
            marker={live?.raw_value}
            inputMin={draft.input_min}
            inputMax={draft.input_max}
          />
        </div>
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

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        'rounded-md border p-2',
        danger
          ? 'border-[var(--color-danger)]/30 text-[var(--color-danger)]'
          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
