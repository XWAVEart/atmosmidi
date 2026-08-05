import { NavLink } from 'react-router-dom'
import { Activity, SlidersHorizontal, Settings2, Radio, Globe2 } from 'lucide-react'
import type { ReactNode } from 'react'

const links = [
  { to: '/', label: 'Monitor', icon: Activity },
  { to: '/location', label: 'Location', icon: Globe2 },
  { to: '/mappings', label: 'Mappings', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

interface Props {
  children: ReactNode
  connected: boolean
  midiOk: boolean
  enabled: boolean
}

export function Layout({ children, connected, midiOk, enabled }: Props) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)]/80 bg-[rgba(5,7,12,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-cyan-400/30 bg-[var(--color-panel)]">
              <Radio className="h-4 w-4 text-[var(--color-cyan)]" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-cyan)] animate-pulse-glow" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-white md:text-2xl">
                AtmosMIDI
              </h1>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
                Weather → MIDI
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition',
                    isActive
                      ? 'bg-[var(--color-panel-2)] text-[var(--color-cyan)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
                  ].join(' ')
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
            <StatusDot ok={connected} label="WS" />
            <StatusDot ok={midiOk} label="MIDI" />
            <StatusDot ok={enabled} label="OUT" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  )
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? 'var(--color-ok)' : 'var(--color-danger)' }}
      />
      {label}
    </div>
  )
}
