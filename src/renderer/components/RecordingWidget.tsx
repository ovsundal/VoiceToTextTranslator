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
  } = useRecorder()

  const buttonLabel =
    status === 'recording' ? '⏹ Stop' :
    status === 'transcribing' ? '⏳ Transcribing...' :
    '⏺ Record'

  const buttonStyle = status === 'recording'
    ? { background: 'var(--accent-danger)' }
    : undefined

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
        style={buttonStyle}
      >
        {buttonLabel}
      </button>

      <p className="widget-status">
        {status === 'error' ? error : ''}
      </p>
    </div>
  )
}
