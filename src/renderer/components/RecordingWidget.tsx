import { useEffect } from 'react'
import { useRecorder } from '../hooks/useRecorder'

export default function RecordingWidget() {
  const {
    status,
    transcript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedModelSize,
    setSelectedModelSize,
    downloadedModels,
    toggleRecording,
    autoCopy,
    setAutoCopy,
  } = useRecorder()

  const isRecording = status === 'recording'

  useEffect(() => {
    document.documentElement.dataset.recording = String(isRecording)
    window.api.setOverlay(isRecording)
    return () => {
      document.documentElement.dataset.recording = 'false'
      window.api.setOverlay(false)
    }
  }, [isRecording])

  function handleCopy() {
    if (transcript) window.api.copyToClipboard(transcript)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      <div className="widget-toolbar">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'no')}
          disabled={status !== 'idle' && status !== 'error'}
        >
          <option value="en">English</option>
          <option value="no">Norwegian</option>
        </select>

        <select
          value={selectedModelSize}
          onChange={(e) => setSelectedModelSize(e.target.value as typeof selectedModelSize)}
          disabled={status !== 'idle' && status !== 'error'}
        >
          {downloadedModels.map((m) => (
            <option key={m.size} value={m.size}>{m.label}</option>
          ))}
        </select>
      </div>

      <textarea
        className="widget-transcript"
        readOnly
        value={transcript}
        placeholder="Transcription will appear here..."
      />

      <button
        className="btn-primary"
        onClick={toggleRecording}
        disabled={status === 'transcribing'}
        style={isRecording ? { background: 'var(--accent-danger)' } : undefined}
      >
        {status === 'transcribing' ? '⏳ Transcribing...' : isRecording ? '⏹ Stop' : '⏺ Record'}
      </button>

      <div className="widget-actions">
        <button
          className="btn-icon"
          onClick={handleCopy}
          disabled={!transcript}
          title="Copy to clipboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        <label className="auto-copy-label">
          <span>Auto-copy</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={autoCopy}
              onChange={(e) => setAutoCopy(e.target.checked)}
            />
            <span className="switch-slider" />
          </label>
        </label>
      </div>

      <p className="hotkey-hint">Press Ctrl+Shift+Space to toggle recording</p>

      <p className="widget-status">
        {status === 'error' ? error : ''}
      </p>
    </div>
  )
}
