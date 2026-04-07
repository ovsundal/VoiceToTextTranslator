import { globalShortcut } from 'electron'
import type { BrowserWindow } from 'electron'

export function registerHotkey(win: BrowserWindow): () => void {
  const registered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.webContents.send('hotkey-toggle')
  })

  if (!registered) {
    console.error('Failed to register global hotkey Ctrl+Shift+Space — may be in use by another app')
  }

  return () => {
    globalShortcut.unregister('CommandOrControl+Shift+Space')
  }
}
