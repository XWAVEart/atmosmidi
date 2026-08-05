export type CurveType = 'linear' | 'exponential' | 'logarithmic' | 's-curve'
export type MidiType = 'cc' | 'note'

export interface Mapping {
  id: string
  name: string
  source: string
  enabled: boolean
  midi_type: MidiType
  channel: number
  cc_number: number | null
  note_number: number | null
  note_velocity: number
  input_min: number
  input_max: number
  output_min: number
  output_max: number
  curve: CurveType
  invert: boolean
  smoothing: number
  send_only_on_change: boolean
  change_threshold: number
}

export interface MappingLiveState {
  id: string
  source: string
  enabled: boolean
  raw_value: number | null
  smoothed_value: number | null
  midi_value: number | null
  last_sent: number | null
}

export interface AppSettings {
  latitude: number
  longitude: number
  location_label: string
  poll_interval: number
  midi_port_name: string
  global_enabled: boolean
  global_intensity: number
  generative_enabled: boolean
  generative_motion_depth: number
  generative_event_probability: number
  generative_chaos: number
  theme: string
  midi_rate_limit_ms: number
}

export interface SystemStatus {
  running: boolean
  global_enabled: boolean
  weather: {
    last_success_at: string | null
    last_attempt_at: string | null
    last_error: string | null
    consecutive_failures: number
    poll_interval: number
    using_cache: boolean
    has_data?: boolean
    value_count?: number
  }
  midi: {
    port_name: string
    connected: boolean
    virtual: boolean
    messages_sent: number
    last_error: string | null
    last_message_at: number | null
    available_outputs: string[]
  }
  mapping_count: number
  enabled_mapping_count: number
  uptime_seconds: number
  version: string
}

export interface WeatherCurrent {
  fetched_at: string
  latitude: number
  longitude: number
  timezone: string
  from_cache: boolean
  values: Record<string, number>
  units: Record<string, string>
  derived: Record<string, number>
  signals: Record<string, number>
}
