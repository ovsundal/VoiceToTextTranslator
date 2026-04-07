import { contextBridge, ipcRenderer } from 'electron'
import type { ModelInfo, ModelSize, DownloadProgress } from '../types/models'

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),

  // Theme
  onThemeChanged: (cb: (theme: 'dark' | 'light') => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, theme: 'dark' | 'light') => cb(theme)
    ipcRenderer.on('theme-changed', handler)
    return () => { ipcRenderer.removeListener('theme-changed', handler) }
  },

  // Model management
  listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('listModels'),
  downloadModel: (size: ModelSize): void => ipcRenderer.send('downloadModel', size),
  onDownloadProgress: (cb: (progress: DownloadProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: DownloadProgress) => cb(progress)
    ipcRenderer.on('download-progress', handler)
    return () => { ipcRenderer.removeListener('download-progress', handler) }
  },

  // Transcription
  transcribe: (wavBuffer: ArrayBuffer, language: 'en' | 'no', modelSize: string): Promise<string> =>
    ipcRenderer.invoke('transcribe', wavBuffer, language, modelSize),

  // Hotkey
  onHotkeyToggle: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('hotkey-toggle', handler)
    return () => { ipcRenderer.removeListener('hotkey-toggle', handler) }
  },

  // Clipboard
  copyToClipboard: (text: string): void => ipcRenderer.send('copyToClipboard', text),

  // Taskbar overlay
  setOverlay: (isRecording: boolean): void => ipcRenderer.send('set-overlay', isRecording),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
