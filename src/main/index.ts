import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { registerHotkey } from './hotkey'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 320,
    resizable: false,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.once('ready-to-show', () => {
    // Send initial theme before showing window to avoid flash
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    win.webContents.send('theme-changed', theme)
    win.show()
  })

  return win
}

app.whenReady().then(() => {
  const mainWindow = createWindow()
  registerIpcHandlers(mainWindow)
  registerHotkey(mainWindow)

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    mainWindow.webContents.send('theme-changed', theme)
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
