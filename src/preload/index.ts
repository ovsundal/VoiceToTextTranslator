import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),

  // Theme
  onThemeChanged: (cb: (theme: 'dark' | 'light') => void) => {
    const handler = (_: Electron.IpcRendererEvent, theme: 'dark' | 'light') => cb(theme)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },

  // TODO Phase 3: transcription
  // transcribe: (wavPath: string, language: 'en' | 'no'): Promise<string> =>
  //   ipcRenderer.invoke('transcribe', wavPath, language),

  // TODO Phase 2: model management
  // listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('listModels'),
  // downloadModel: (size: ModelSize): void => ipcRenderer.send('downloadModel', size),
  // onDownloadProgress: (cb: (progress: DownloadProgress) => void) => { ... },

  // TODO Phase 4: hotkey
  // onHotkeyPressed: (cb: () => void) => { ... },
  // onHotkeyReleased: (cb: () => void) => { ... },

  // TODO Phase 4: clipboard
  // copyToClipboard: (text: string): void => ipcRenderer.send('copyToClipboard', text),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
