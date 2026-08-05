import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useLive } from './hooks/useLive'
import { Dashboard } from './pages/Dashboard'
import { LocationPage } from './pages/Location'
import { MappingsPage } from './pages/Mappings'
import { SettingsPage } from './pages/Settings'
import { api } from './lib/api'

export default function App() {
  const live = useLive()

  const refreshStatus = async () => {
    try {
      const status = await api.status()
      live.setStatus(status)
      const mappings = await api.mappings()
      live.setMappings(mappings)
    } catch {
      /* ignore */
    }
  }

  return (
    <BrowserRouter>
      <Layout
        connected={live.connected}
        midiOk={!!live.status?.midi.connected}
        enabled={!!live.status?.global_enabled}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                status={live.status}
                weather={live.weather}
                signals={live.signals}
                mappings={live.mappings}
                mappingLive={live.mappingLive}
                onSettingsChange={refreshStatus}
              />
            }
          />
          <Route
            path="/location"
            element={
              <LocationPage weather={live.weather} onSaved={refreshStatus} />
            }
          />
          <Route
            path="/mappings"
            element={
              <MappingsPage
                mappings={live.mappings}
                mappingLive={live.mappingLive}
                onChange={live.setMappings}
              />
            }
          />
          <Route
            path="/settings"
            element={<SettingsPage status={live.status} onSaved={refreshStatus} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
