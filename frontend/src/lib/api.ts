import type { AppSettings, Mapping, SystemStatus, WeatherCurrent } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  status: () => request<SystemStatus>('/api/status'),
  weather: () => request<WeatherCurrent>('/api/weather/current'),
  sources: () => request<{ sources: string[] }>('/api/sources'),
  mappings: () => request<Mapping[]>('/api/mappings'),
  createMapping: (body: Partial<Mapping>) =>
    request<Mapping>('/api/mappings', { method: 'POST', body: JSON.stringify(body) }),
  updateMapping: (id: string, body: Partial<Mapping>) =>
    request<Mapping>(`/api/mappings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMapping: (id: string) =>
    request<{ ok: boolean }>(`/api/mappings/${id}`, { method: 'DELETE' }),
  duplicateMapping: (id: string) =>
    request<Mapping>(`/api/mappings/${id}/duplicate`, { method: 'POST' }),
  testMapping: (id: string) =>
    request<{ ok: boolean; error?: string }>(`/api/mappings/${id}/test`, { method: 'POST' }),
  settings: () => request<AppSettings>('/api/settings'),
  updateSettings: (body: AppSettings) =>
    request<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  exportPresets: () => request<unknown>('/api/presets/export'),
  importPresets: (body: unknown) =>
    request<unknown>('/api/presets/import', { method: 'POST', body: JSON.stringify(body) }),
}
