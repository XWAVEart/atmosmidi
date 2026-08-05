import { useEffect, useRef, useState } from 'react'
import type { Mapping, MappingLiveState, SystemStatus, WeatherCurrent } from '../lib/types'
import { api } from '../lib/api'

interface LiveState {
  connected: boolean
  status: SystemStatus | null
  weather: WeatherCurrent | null
  signals: Record<string, number>
  mappingLive: Record<string, MappingLiveState>
  mappings: Mapping[]
}

export function useLive() {
  const [state, setState] = useState<LiveState>({
    connected: false,
    status: null,
    weather: null,
    signals: {},
    mappingLive: {},
    mappings: [],
  })
  const retryRef = useRef(0)

  useEffect(() => {
    let ws: WebSocket | null = null
    let closed = false
    let timer: number | undefined

    const connect = () => {
      if (closed) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${window.location.host}/ws/live`
      ws = new WebSocket(url)

      ws.onopen = () => {
        retryRef.current = 0
        setState((s) => ({ ...s, connected: true }))
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'ping') return
          setState((s) => {
            if (msg.type === 'status') return { ...s, status: msg.data }
            if (msg.type === 'weather') {
              return {
                ...s,
                weather: msg.data,
                signals: msg.data.signals || s.signals,
              }
            }
            if (msg.type === 'mappings') return { ...s, mappings: msg.data }
            if (msg.type === 'live') {
              return {
                ...s,
                signals: msg.data.signals || s.signals,
                mappingLive: msg.data.mappings || s.mappingLive,
                status: s.status
                  ? {
                      ...s.status,
                      global_enabled: msg.data.global_enabled ?? s.status.global_enabled,
                      midi: msg.data.midi || s.status.midi,
                    }
                  : s.status,
              }
            }
            return s
          })
        } catch {
          /* ignore */
        }
      }

      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }))
        if (closed) return
        const delay = Math.min(8000, 500 + retryRef.current * 800)
        retryRef.current += 1
        timer = window.setTimeout(connect, delay)
      }
    }

    connect()

    // REST bootstrap
    Promise.all([api.status(), api.mappings(), api.weather().catch(() => null)])
      .then(([status, mappings, weather]) => {
        setState((s) => ({
          ...s,
          status,
          mappings,
          weather: weather || s.weather,
          signals: weather?.signals || s.signals,
        }))
      })
      .catch(() => undefined)

    return () => {
      closed = true
      if (timer) window.clearTimeout(timer)
      ws?.close()
    }
  }, [])

  const setMappings = (mappings: Mapping[]) =>
    setState((s) => ({ ...s, mappings }))

  const setStatus = (status: SystemStatus) =>
    setState((s) => ({ ...s, status }))

  return { ...state, setMappings, setStatus }
}
