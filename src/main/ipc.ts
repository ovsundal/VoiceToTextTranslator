import { ipcMain, BrowserWindow } from 'electron'
import { listModels, downloadModel } from './modelManager'
import { transcribe } from './transcriber'
import type { ModelSize } from '../types/models'

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

  // TODO Phase 4: clipboard
  // ipcMain.handle('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })
}
