import { ipcMain, BrowserWindow, clipboard, nativeImage } from 'electron'
import { listModels, downloadModel } from './modelManager'
import { transcribe } from './transcriber'
import type { ModelSize } from '../types/models'

const REC_DOT_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVR42mNgGJTgc/eK/9gw2RqJNogiA4jVjNOQUQOoYMDApwOqJOUBAQAqGoX8qw36TwAAAABJRU5ErkJggg=='
const recDotIcon = nativeImage.createFromDataURL(`data:image/png;base64,${REC_DOT_B64}`)

export function registerIpcHandlers(win: BrowserWindow): void {
  // Titlebar controls
  ipcMain.on('minimize', () => win.minimize())
  ipcMain.on('close', () => win.close())

  // Model management
  ipcMain.handle('listModels', () => listModels())

  ipcMain.on('downloadModel', (_, size: string) => {
    downloadModel(size as ModelSize, (progress) => {
      win.webContents.send('download-progress', progress)
    }).catch(console.error)
  })

  // Transcription
  ipcMain.handle('transcribe', async (_, wavBuffer: ArrayBuffer, language: string, modelSize: string) => {
    const models = listModels()
    const model = models.find(m => m.size === modelSize && m.downloaded)
    if (!model?.path) throw new Error(`Model '${modelSize}' not found or not downloaded`)
    return transcribe(Buffer.from(wavBuffer), model.path, language as 'en' | 'no')
  })

  // Clipboard
  ipcMain.on('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })

  // Taskbar overlay
  ipcMain.on('set-overlay', (_, isRecording: boolean) => {
    win.setOverlayIcon(isRecording ? recDotIcon : null, isRecording ? 'Recording' : '')
  })
}
