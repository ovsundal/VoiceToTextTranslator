import { ipcMain, BrowserWindow } from 'electron'
import { listModels, downloadModel } from './modelManager'
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

  // TODO Phase 3: transcribe handler
  // ipcMain.handle('transcribe', async (_, wavPath: string, language: string) => { ... })

  // TODO Phase 4: clipboard
  // ipcMain.handle('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })
}
