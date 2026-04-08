import { useEffect, useState } from 'react'
import ModelSetup from './components/ModelSetup'
import RecordingWidget from './components/RecordingWidget'
import { SettingsPanel } from './components/SettingsPanel'
import type { ModelSize } from '../types/models'

type Theme = 'dark' | 'light'
type AppState = 'loading' | 'setup' | 'ready'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })
  const [appState, setAppState] = useState<AppState>('loading')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeModelSize, setActiveModelSize] = useState<ModelSize>(
    () => (localStorage.getItem('selectedModelSize') as ModelSize) ?? 'base'
  )

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes via IPC
  useEffect(() => {
    const cleanup = window.api.onThemeChanged((newTheme: Theme) => {
      setTheme(newTheme)
    })
    return cleanup
  }, [])

  // Check if a model is available
  useEffect(() => {
    window.api.listModels().then((models) => {
      const hasModel = models.some((m) => m.downloaded)
      setAppState(hasModel ? 'ready' : 'setup')
    })
  }, [])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  const handleModelChange = (size: ModelSize) => {
    setActiveModelSize(size)
    localStorage.setItem('selectedModelSize', size)
  }

  const handleAllModelsDeleted = () => {
    setSettingsOpen(false)
    setAppState('setup')
  }

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-title">Voice-to-Text-Transcriber</span>
        <div className="titlebar-controls">
          <button onClick={() => setSettingsOpen(s => !s)} title="Settings">⚙</button>
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => window.api.minimize()} title="Minimize">−</button>
          <button className="btn-close" onClick={() => window.api.close()} title="Close">✕</button>
        </div>
      </div>

      <div className="app-content">
        {appState === 'loading' && (
          <div className="loading-spinner">
            <span>Loading…</span>
          </div>
        )}
        {appState === 'setup' && (
          <ModelSetup onComplete={() => setAppState('ready')} />
        )}
        {appState === 'ready' && !settingsOpen && (
          <RecordingWidget
            activeModelSize={activeModelSize}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {appState === 'ready' && settingsOpen && (
          <SettingsPanel
            currentModelSize={activeModelSize}
            onModelChange={handleModelChange}
            onClose={() => setSettingsOpen(false)}
            onAllModelsDeleted={handleAllModelsDeleted}
          />
        )}
      </div>
    </>
  )
}
