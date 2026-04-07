import { useEffect, useState } from 'react'
import type { ModelSize, ModelInfo, DownloadProgress } from '../../types/models'

interface ModelSetupProps {
  onComplete: () => void
}

export default function ModelSetup({ onComplete }: ModelSetupProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selected, setSelected] = useState<ModelSize>('base')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    window.api.listModels().then(setModels)
  }, [])

  useEffect(() => {
    if (!isDownloading) return
    const cleanup = window.api.onDownloadProgress((p) => {
      setProgress(p)
      if (p.status === 'complete') {
        setIsDownloading(false)
        onComplete()
      }
      if (p.status === 'error') {
        setIsDownloading(false)
      }
    })
    return cleanup
  }, [isDownloading, onComplete])

  function handleDownload() {
    setIsDownloading(true)
    setProgress(null)
    window.api.downloadModel(selected)
  }

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }

  return (
    <div className="setup-screen">
      <p className="setup-title">Choose a transcription model</p>

      <div className="model-list">
        {models.map((m) => (
          <label key={m.size} className={`model-option ${selected === m.size ? 'selected' : ''}`}>
            <input
              type="radio"
              name="model"
              value={m.size}
              checked={selected === m.size}
              onChange={() => setSelected(m.size)}
              disabled={isDownloading}
            />
            <span className="model-label">{m.label}</span>
            {m.downloaded && <span className="model-badge">✓</span>}
          </label>
        ))}
      </div>

      {!isDownloading && (
        <button className="btn-primary" onClick={handleDownload}>
          Download
        </button>
      )}

      {isDownloading && progress && (
        <div className="progress-area">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="progress-meta">
            <span>{progress.percent}%</span>
            <span>{formatSpeed(progress.speedBytesPerSec)}</span>
          </div>
          {progress.status === 'error' && (
            <p className="progress-error">{progress.error ?? 'Download failed'}</p>
          )}
        </div>
      )}
    </div>
  )
}
