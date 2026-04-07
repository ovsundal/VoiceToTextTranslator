import { useState, useRef, useEffect, useCallback } from 'react'
import { recordAudio } from '../recorder'
import type { ModelSize, ModelInfo } from '../../types/models'

type RecorderStatus = 'idle' | 'recording' | 'transcribing' | 'error'

interface RecorderControls {
  start: () => void
  stop: () => Promise<ArrayBuffer>
}

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'no'>('en')
  const [selectedModelSize, setSelectedModelSize] = useState<ModelSize>('base')
  const [downloadedModels, setDownloadedModels] = useState<ModelInfo[]>([])
  const [autoCopy, setAutoCopy] = useState(true)

  const recorderRef = useRef<RecorderControls | null>(null)

  useEffect(() => {
    window.api.listModels().then((models) => {
      const available = models.filter((m) => m.downloaded)
      setDownloadedModels(available)
      if (available.length > 0) {
        setSelectedModelSize(available[0].size)
      }
    })
  }, [])

  const toggleRecording = useCallback(async () => {
    if (status === 'idle' || status === 'error') {
      setError(null)
      try {
        const controls = await recordAudio()
        recorderRef.current = controls
        controls.start()
        setStatus('recording')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording')
        setStatus('error')
      }
    } else if (status === 'recording') {
      if (!recorderRef.current) return
      setStatus('transcribing')
      try {
        const wavBuffer = await recorderRef.current.stop()
        recorderRef.current = null
        const text = await window.api.transcribe(wavBuffer, selectedLanguage, selectedModelSize)
        setTranscript(text)
        setStatus('idle')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed')
        setStatus('error')
      }
    }
  }, [status, selectedLanguage, selectedModelSize])

  useEffect(() => {
    if (transcript && autoCopy) {
      window.api.copyToClipboard(transcript)
    }
  }, [transcript, autoCopy])

  useEffect(() => {
    const cleanup = window.api.onHotkeyToggle(() => {
      toggleRecording()
    })
    return cleanup
  }, [toggleRecording])

  return {
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
  }
}
