import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })

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

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  function handleMinimize() {
    window.api.minimize()
  }

  function handleClose() {
    window.api.close()
  }

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-title">VoiceToText</span>
        <div className="titlebar-controls">
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleMinimize} title="Minimize">−</button>
          <button className="btn-close" onClick={handleClose} title="Close">✕</button>
        </div>
      </div>

      <div className="app-content">
        {/* Phase 2+: Model setup screen / main widget will replace this placeholder */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          Phase 1 scaffold — ready for feature implementation.
        </p>
      </div>
    </>
  )
}
