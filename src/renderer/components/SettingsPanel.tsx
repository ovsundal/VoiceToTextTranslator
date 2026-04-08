import { useState, useEffect, useRef } from 'react'
import type { ModelInfo, ModelSize, DownloadProgress } from '../../types/models'

interface SettingsPanelProps {
  currentModelSize: ModelSize
  onModelChange: (size: ModelSize) => void
  onClose: () => void
  onAllModelsDeleted: () => void
}

export function SettingsPanel({ currentModelSize, onModelChange, onClose, onAllModelsDeleted }: SettingsPanelProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [downloading, setDownloading] = useState<ModelSize | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const refreshModels = async () => {
    const list = await window.api.listModels()
    setModels(list)
    return list
  }

  useEffect(() => {
    refreshModels()
    return () => { cleanupRef.current?.() }
  }, [])

  const handleDownload = (size: ModelSize) => {
    setDownloading(size)
    setError(null)
    window.api.downloadModel(size)
    cleanupRef.current = window.api.onDownloadProgress((p) => {
      setProgress(p)
      if (p.status === 'complete') {
        setDownloading(null)
        setProgress(null)
        cleanupRef.current?.()
        refreshModels()
      } else if (p.status === 'error') {
        setError(p.error ?? 'Download failed')
        setDownloading(null)
        setProgress(null)
        cleanupRef.current?.()
        refreshModels()
      }
    })
  }

  const handleDelete = async (size: ModelSize) => {
    if (size === currentModelSize) {
      const others = models.filter(m => m.downloaded && m.size !== size)
      if (others.length > 0) onModelChange(others[0].size)
    }
    window.api.deleteModel(size)
    setTimeout(async () => {
      const updated = await refreshModels()
      const remaining = updated.filter(m => m.downloaded)
      if (remaining.length === 0) {
        onAllModelsDeleted()
      }
    }, 300)
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span className="settings-title">Manage Models</span>
        <button className="btn-icon" onClick={onClose} title="Close settings">✕</button>
      </div>

      <div className="model-list-settings">
        {models.map(model => (
          <div key={model.size} className={`model-row ${model.size === currentModelSize ? 'model-row--active' : ''}`}>
            <div className="model-row-info">
              <label className="model-row-label">
                <input
                  type="radio"
                  name="activeModel"
                  value={model.size}
                  checked={model.size === currentModelSize}
                  disabled={!model.downloaded}
                  onChange={() => onModelChange(model.size)}
                />
                <span>{model.label}</span>
              </label>
              {model.downloaded && <span className="model-downloaded-badge">✓</span>}
            </div>

            {downloading === model.size && progress ? (
              <div className="model-row-progress">
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <span className="progress-text">{progress.percent.toFixed(0)}%</span>
              </div>
            ) : (
              <div className="model-row-actions">
                {!model.downloaded ? (
                  <button
                    className="btn-small"
                    onClick={() => handleDownload(model.size)}
                    disabled={downloading !== null}
                  >
                    Download
                  </button>
                ) : (
                  <button
                    className="btn-small btn-small--danger"
                    onClick={() => handleDelete(model.size)}
                    disabled={downloading !== null}
                    title="Delete this model"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="widget-status error">{error}</div>}
    </div>
  )
}
