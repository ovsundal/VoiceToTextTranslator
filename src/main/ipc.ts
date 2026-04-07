import { ipcMain, BrowserWindow } from 'electron'

export function registerIpcHandlers(win: BrowserWindow): void {
  // Titlebar controls
  ipcMain.on('minimize', () => win.minimize())
  ipcMain.on('close', () => win.close())

  // TODO Phase 3: transcribe handler
  // ipcMain.handle('transcribe', async (_, wavPath: string, language: string) => { ... })

  // TODO Phase 2: model management handlers
  // ipcMain.handle('listModels', async () => { ... })
  // ipcMain.handle('downloadModel', async (_, size: string) => { ... })

  // TODO Phase 4: clipboard
  // ipcMain.handle('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })
}
