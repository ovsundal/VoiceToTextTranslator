import { UiohookKey, uIOhook } from 'uiohook-napi'
import type { BrowserWindow } from 'electron'

let started = false

export function registerHotkey(win: BrowserWindow): () => void {
  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Space && e.ctrlKey && e.shiftKey) {
      win.webContents.send('hotkey-pressed')
    }
  })

  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Space) {
      win.webContents.send('hotkey-released')
    }
  })

  if (!started) {
    uIOhook.start()
    started = true
  }

  return () => {
    uIOhook.stop()
    started = false
  }
}
