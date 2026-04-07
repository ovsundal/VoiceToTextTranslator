import { useEffect, useState } from 'react'
import ModelSetup from './components/ModelSetup'
import RecordingWidget from './components/RecordingWidget'

type Theme = 'dark' | 'light'
type AppState = 'loading' | 'setup' | 'ready'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })
  const [appState, setAppState] = useState<AppState>('loading')

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

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-title">VoiceToText</span>
        <div className="titlebar-controls">
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => window.api.minimize()} title="Minimize">−</button>
          <button className="btn-close" onClick={() => window.api.close()} title="Close">✕</button>
        </div>
      </div>

      <div className="app-content">
        {appState === 'loading' && null}
        {appState === 'setup' && (
          <ModelSetup onComplete={() => setAppState('ready')} />
        )}
        {appState === 'ready' && <RecordingWidget />}
      </div>
    </>
  )
}
