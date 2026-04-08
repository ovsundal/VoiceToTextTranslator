import { useState, useRef, useEffect, useCallback } from 'react'
import { recordAudio } from '../recorder'
import { playChime } from '../chime'
import type { ModelSize, ModelInfo } from '../../types/models'

type RecorderStatus = 'idle' | 'recording' | 'transcribing' | 'error'

interface RecorderControls {
  start: () => void
  stop: () => Promise<ArrayBuffer>
}

export function useRecorder(initialModelSize?: ModelSize) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'no'>('en')
  const [selectedModelSize, setSelectedModelSize] = useState<ModelSize>(
    initialModelSize ?? (localStorage.getItem('selectedModelSize') as ModelSize) ?? 'base'
  )
  const [downloadedModels, setDownloadedModels] = useState<ModelInfo[]>([])
  const [autoCopy, setAutoCopy] = useState(true)
  const [autoPaste, setAutoPasteState] = useState(() => localStorage.getItem('autoPaste') === 'true')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // History ring buffer
  const MAX_HISTORY = 10
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(0)

  const recorderRef = useRef<RecorderControls | null>(null)

  const setAutoPaste = useCallback((val: boolean) => {
    setAutoPasteState(val)
    localStorage.setItem('autoPaste', String(val))
  }, [])

  useEffect(() => {
    window.api.listModels().then((models) => {
      const available = models.filter((m) => m.downloaded)
      setDownloadedModels(available)
      if (available.length > 0) {
        const preferred = initialModelSize ?? (localStorage.getItem('selectedModelSize') as ModelSize)
        const match = available.find(m => m.size === preferred)
        setSelectedModelSize(match ? match.size : available[0].size)
      }
    })
  }, [])

  const updateModelSize = useCallback((size: ModelSize) => {
    setSelectedModelSize(size)
    localStorage.setItem('selectedModelSize', size)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (status === 'idle' || status === 'error') {
      setError(null)
      try {
        const controls = await recordAudio()
        recorderRef.current = controls
        controls.start()
        playChime('start')
        setRecordingSeconds(0)
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
        setStatus('recording')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording')
        setStatus('error')
      }
    } else if (status === 'recording') {
      if (!recorderRef.current) return
      setStatus('transcribing')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      playChime('stop')
      try {
        const wavBuffer = await recorderRef.current.stop()
        recorderRef.current = null
        const text = await window.api.transcribe(wavBuffer, selectedLanguage, selectedModelSize)
        setTranscript(text)
        setHistory(prev => {
          const next = [...prev, text]
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        })
        setHistoryIdx(-1)
        setStatus('idle')
      } catch (err) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
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
    if (history.length > 0 && autoPaste) {
      window.api.autoPaste().catch(console.error)
    }
  }, [history, autoPaste])

  useEffect(() => {
    const cleanup = window.api.onHotkeyToggle(() => {
      toggleRecording()
    })
    return cleanup
  }, [toggleRecording])

  // Resolve the actual index when historyIdx is -1 (latest)
  const resolvedIdx = historyIdx === -1 ? history.length - 1 : historyIdx
  const displayedTranscript = history[resolvedIdx] ?? ''

  const canGoBack = resolvedIdx > 0
  const canGoFwd = resolvedIdx < history.length - 1

  const goBack = useCallback(() => {
    setHistoryIdx(prev => {
      const cur = prev === -1 ? history.length - 1 : prev
      return Math.max(0, cur - 1)
    })
  }, [history.length])

  const goFwd = useCallback(() => {
    setHistoryIdx(prev => {
      const cur = prev === -1 ? history.length - 1 : prev
      const next = cur + 1
      return next >= history.length ? -1 : next
    })
  }, [history.length])

  return {
    status,
    transcript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedModelSize,
    updateModelSize,
    downloadedModels,
    toggleRecording,
    autoCopy,
    setAutoCopy,
    autoPaste,
    setAutoPaste,
    recordingSeconds,
    history,
    displayedTranscript,
    canGoBack,
    canGoFwd,
    goBack,
    goFwd,
  }
}
