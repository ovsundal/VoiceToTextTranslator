# Feature: Phase 1 — Project Scaffold

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to import paths across the three Electron processes (main / preload / renderer) — electron-vite builds each independently with different module contexts.

## Feature Description

Establish the full project scaffold for VoiceToText Translator: replace the bare-minimum placeholder with a working Electron + React + TypeScript app using electron-vite. The result is a running 340×280px frameless widget with a custom titlebar, light/dark theme driven by IPC, and a typed `window.api` contextBridge skeleton — ready for Phase 2 feature implementation.

## User Story

As a developer,
I want a working Electron app shell with React UI and typed IPC surface,
So that all subsequent feature phases have a solid, runnable foundation to build on.

## Problem Statement

The current project is a bare stub (`src/index.ts` with a single `console.log`). There is no Electron, no React, no build tooling, and no IPC surface. Nothing can run.

## Solution Statement

Install electron-vite with React + TypeScript, restructure `src/` into `main/`, `renderer/`, and `preload/` sub-trees, configure BrowserWindow with the correct sizing and security settings, wire IPC-driven theme switching from `nativeTheme`, implement the CSS variable theme system, and expose a fully typed `window.api` skeleton in the preload — leaving all method bodies as stubs to be filled in later phases.

## Feature Metadata

**Feature Type**: New Capability (project scaffold)
**Estimated Complexity**: Medium
**Primary Systems Affected**: Build config, main process, renderer, preload
**Dependencies**: electron 33+, react 18+, electron-vite 2+, @vitejs/plugin-react, electron-builder 25+, @electron-toolkit/preload

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `package.json` — Current stub; will be fully replaced
- `tsconfig.json` — Current basic config; will be replaced with electron-vite multi-tsconfig pattern
- `src/index.ts` — Current placeholder; delete after scaffold is in place
- `.claude/CLAUDE.md` — Architecture constraints, naming conventions, IPC pattern rules
- `.claude/PRD.md` — UI layout mock (section 9), IPC API surface (section 10), success criteria
- `.claude/skills/electron-styling/SKILL.md` — All CSS/theming patterns; **mandatory reference** for styles.css
- `.claude/skills/react-components/SKILL.md` — React component patterns; **mandatory reference** for App.tsx

### New Files to Create

**Config / root:**
- `electron.vite.config.ts` — electron-vite build config (main + preload + renderer)
- `electron-builder.yml` — Packaging config (NSIS, extraResources for whisper binary)
- `tsconfig.json` — Replace with electron-vite recommended multi-config (extends node/web)
- `tsconfig.node.json` — For main + preload (CommonJS/Node target)
- `tsconfig.web.json` — For renderer (ESNext/DOM target)

**Main process:**
- `src/main/index.ts` — Electron entry: app lifecycle, BrowserWindow creation
- `src/main/ipc.ts` — All ipcMain.handle registrations (stubs for now)

**Renderer:**
- `src/renderer/index.html` — HTML shell with React mount point
- `src/renderer/main.tsx` — ReactDOM.createRoot entry
- `src/renderer/App.tsx` — Root component with theme state
- `src/renderer/styles.css` — CSS variables, light/dark mode, titlebar, base layout

**Preload:**
- `src/preload/index.ts` — contextBridge.exposeInMainWorld with full `window.api` skeleton

**Types:**
- `src/types/electron.d.ts` — Global `Window` interface augmentation for `window.api`

### Relevant Documentation

- [electron-vite Getting Started](https://electron-vite.org/guide/) — Project structure, config API, multi-tsconfig pattern
- [electron-vite React Template](https://github.com/electron-vite/electron-vite-react) — Reference scaffold to mirror
- [Electron: Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) — frameless window + drag region
- [Electron: Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — contextBridge security rules
- [Electron: contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge) — exposeInMainWorld constraints
- [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) — webPreferences, sizing
- [Electron: nativeTheme](https://www.electronjs.org/docs/latest/api/native-theme) — `shouldUseDarkColors`, `updated` event

### Patterns to Follow

**Naming Conventions (from CLAUDE.md):**
- Files: `camelCase.ts` (e.g. `modelManager.ts`, `recorder.ts`)
- Types/Interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` at module level

**IPC Pattern (from CLAUDE.md):**
- All `ipcMain.handle` registrations live in `src/main/ipc.ts`
- All `contextBridge.exposeInMainWorld` calls live in `src/preload/index.ts`
- Renderer only calls `window.api.*` — never accesses Node APIs directly
- One-way events (theme change, hotkey press) use `ipcRenderer.on` / `webContents.send`

**Theme IPC Flow (from electron-styling/SKILL.md):**
1. Main: read `nativeTheme.shouldUseDarkColors` on startup → send to renderer
2. Renderer: apply `document.documentElement.dataset.theme = 'dark' | 'light'`
3. Main: listen to `nativeTheme.on('updated')` → send update to renderer
4. Manual toggle: flip `data-theme`, persist to `localStorage`

**CSS Pattern (from electron-styling/SKILL.md):**
```css
:root[data-theme="dark"] {
  --bg: #1e1e2e;
  --bg-secondary: #2a2a3e;
  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --accent: #89b4fa;
  --thumb-color: #45475a;
  --thumb-hover: #585b70;
}
:root[data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f5f5f5;
  --text: #1a1a1a;
  --text-secondary: #666666;
  --accent: #5865f2;
  --thumb-color: #cccccc;
  --thumb-hover: #aaaaaa;
}
```

**Titlebar CSS (from electron-styling/SKILL.md):**
```css
.titlebar {
  -webkit-app-region: drag;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}
.titlebar-controls {
  -webkit-app-region: no-drag; /* REQUIRED — buttons must be clickable */
}
```

**contextBridge Pattern:**
```typescript
// GOOD ✓ — expose only specific, typed methods
contextBridge.exposeInMainWorld('api', {
  transcribe: (wavPath: string, lang: 'en' | 'no') =>
    ipcRenderer.invoke('transcribe', wavPath, lang),
});
// BAD ❌ — never expose raw ipcRenderer
contextBridge.exposeInMainWorld('ipc', ipcRenderer);
```

**BrowserWindow path resolution (from CLAUDE.md):**
```typescript
const preloadPath = app.isPackaged
  ? path.join(__dirname, '../preload/index.js')
  : path.join(__dirname, '../../src/preload/index.ts') // electron-vite handles this
```
With electron-vite, use `path.join(__dirname, '../preload/index.js')` — vite resolves correctly in both dev and prod.

---

## IMPLEMENTATION PLAN

### Phase 1: Dependency Installation & Config Files

Replace package.json and all config files before touching src/.

**Tasks:**
- Replace `package.json` with full dependency list
- Create `electron.vite.config.ts`
- Replace `tsconfig.json` and create `tsconfig.node.json` + `tsconfig.web.json`
- Create `electron-builder.yml`
- Run `npm install`

### Phase 2: Main Process

Create the Electron entry point and IPC stub.

**Tasks:**
- Create `src/main/index.ts` — app lifecycle + BrowserWindow
- Create `src/main/ipc.ts` — placeholder handlers for all window.api methods

### Phase 3: Renderer

Create the React shell and CSS theme system.

**Tasks:**
- Create `src/renderer/index.html`
- Create `src/renderer/styles.css` — full CSS variable system, titlebar, base layout
- Create `src/renderer/main.tsx` — ReactDOM.createRoot
- Create `src/renderer/App.tsx` — root component with theme state and placeholder layout

### Phase 4: Preload & Types

Expose the typed API surface.

**Tasks:**
- Create `src/preload/index.ts` — contextBridge with full window.api skeleton
- Create `src/types/electron.d.ts` — Window interface augmentation

### Phase 5: Cleanup & Validation

**Tasks:**
- Delete `src/index.ts` (placeholder)
- Run `npm run dev` — confirm app launches
- Verify all TypeScript strict-mode checks pass

---

## STEP-BY-STEP TASKS

### UPDATE `package.json`

- **IMPLEMENT**: Replace entirely with electron-vite project structure, all dependencies
- **GOTCHA**: `"main"` must point to `"dist/main/index.js"` (electron-vite output path)
- **GOTCHA**: `"type"` field should NOT be `"module"` — electron-vite handles ESM internally
- **VALIDATE**: `cat package.json | grep -E '"main"|"type"|"scripts"'`

```json
{
  "name": "VoiceToTextTranslator",
  "version": "1.0.0",
  "description": "Offline voice-to-text for Windows",
  "main": "dist/main/index.js",
  "private": true,
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "npm run build && electron-builder"
  },
  "dependencies": {
    "electron": "^33.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@electron-toolkit/preload": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^2.3.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.0"
  }
}
```

---

### CREATE `electron.vite.config.ts`

- **IMPLEMENT**: electron-vite config with three build targets: main, preload, renderer
- **PATTERN**: Mirror electron-vite/electron-vite-react template config
- **GOTCHA**: Main and preload are built as CommonJS; renderer is ESM with React plugin
- **VALIDATE**: `npx electron-vite build --dry-run` (or just `npm run build`)

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
})
```

---

### REPLACE `tsconfig.json`

- **IMPLEMENT**: Root tsconfig that references node and web configs
- **GOTCHA**: electron-vite requires separate tsconfigs for node (main/preload) vs web (renderer)
- **VALIDATE**: `npx tsc --noEmit`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

---

### CREATE `tsconfig.node.json`

- **IMPLEMENT**: TypeScript config for main process and preload (Node.js environment)
- **GOTCHA**: Must include `src/main/**/*` and `src/preload/**/*`

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
  "include": ["electron.vite.config.*", "src/main/**/*", "src/preload/**/*"],
  "compilerOptions": {
    "composite": true,
    "types": ["electron-vite/node"],
    "paths": {}
  }
}
```

**ALTERNATIVE** if `@electron-toolkit/tsconfig` is not used:
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["electron.vite.config.*", "src/main/**/*", "src/preload/**/*"]
}
```

---

### CREATE `tsconfig.web.json`

- **IMPLEMENT**: TypeScript config for renderer process (browser/DOM environment)
- **GOTCHA**: Must include DOM lib; do NOT include Node types here

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/types/**/*"]
}
```

---

### CREATE `electron-builder.yml`

- **IMPLEMENT**: Windows NSIS packaging config, include whisper binary as extraResource
- **GOTCHA**: `extraResources` copies files to `resources/` in the packaged app; prebuilt binary path must match what `transcriber.ts` expects
- **VALIDATE**: `npm run package` (only needed later; verify file exists for now)

```yaml
appId: com.voicetotext.translator
productName: VoiceToText Translator
copyright: Copyright © 2024

directories:
  output: dist-app
  buildResources: build

files:
  - dist/**/*
  - node_modules/**/*
  - package.json

extraResources:
  - from: resources/whisper
    to: whisper
    filter:
      - "**/*"

win:
  target:
    - target: nsis
      arch:
        - x64

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

---

### RUN `npm install`

- **IMPLEMENT**: Install all dependencies from updated package.json
- **VALIDATE**: `ls node_modules/electron node_modules/electron-vite node_modules/react`

---

### CREATE `src/main/index.ts`

- **IMPLEMENT**: Electron app entry. Creates BrowserWindow (340×280, frameless), loads renderer, sends initial theme via IPC, registers nativeTheme listener.
- **GOTCHA**: `webPreferences.preload` path must use `path.join(__dirname, '../preload/index.js')` — electron-vite outputs preload to `dist/preload/index.js`
- **GOTCHA**: Never set `nodeIntegration: true` — use contextBridge only
- **GOTCHA**: Call `registerIpcHandlers(mainWindow)` from `ipc.ts` after window creation
- **VALIDATE**: `npm run dev` — window should open

```typescript
import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 280,
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

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    mainWindow.webContents.send('theme-changed', theme)
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
```

---

### CREATE `src/main/ipc.ts`

- **IMPLEMENT**: All ipcMain.handle registrations. Phase 1: only titlebar controls + theme wiring. All Phase 2–4 handlers are stubbed with TODO comments.
- **PATTERN**: All IPC handlers live here — never scattered in index.ts
- **VALIDATE**: App launches without IPC-related errors in console

```typescript
import { ipcMain, BrowserWindow, clipboard } from 'electron'

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
```

---

### CREATE `src/renderer/index.html`

- **IMPLEMENT**: HTML shell. React mounts into `#root`. Sets initial `data-theme` via inline script to avoid flash-of-wrong-theme before IPC fires.
- **GOTCHA**: electron-vite expects `<script type="module" src="/src/renderer/main.tsx">` in dev mode — this is handled automatically; just reference the entry
- **VALIDATE**: `npm run dev` — page renders

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VoiceToText</title>
    <script>
      // Apply persisted theme immediately to avoid flash
      const saved = localStorage.getItem('theme')
      if (saved) document.documentElement.dataset.theme = saved
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

---

### CREATE `src/renderer/styles.css`

- **IMPLEMENT**: Full CSS variable system for light/dark mode, titlebar drag region, base layout, typography, scrollbars, transitions. Follow electron-styling/SKILL.md exactly.
- **PATTERN**: `.claude/skills/electron-styling/SKILL.md` — use all patterns verbatim
- **GOTCHA**: `data-theme` goes on `<html>`, not `<body>`
- **GOTCHA**: Titlebar controls need `-webkit-app-region: no-drag`
- **VALIDATE**: Toggle theme in app — colors change; titlebar is draggable; buttons clickable

```css
*, *::before, *::after {
  box-sizing: border-box;
}

:root[data-theme="dark"] {
  --bg: #1e1e2e;
  --bg-secondary: #2a2a3e;
  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --accent: #89b4fa;
  --accent-danger: #f38ba8;
  --border: #45475a;
  --thumb-color: #45475a;
  --thumb-hover: #585b70;
}

:root[data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f5f5f5;
  --text: #1a1a1a;
  --text-secondary: #666666;
  --accent: #5865f2;
  --accent-danger: #e53935;
  --border: #e0e0e0;
  --thumb-color: #cccccc;
  --thumb-hover: #aaaaaa;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  transition: background-color 200ms ease, color 200ms ease;
}

#root {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Custom Titlebar */
.titlebar {
  -webkit-app-region: drag;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.titlebar-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  user-select: none;
}

.titlebar-controls {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}

.titlebar-controls button {
  width: 28px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 100ms ease-out;
}

.titlebar-controls button:hover {
  background: var(--border);
  color: var(--text);
}

.titlebar-controls .btn-close:hover {
  background: var(--accent-danger);
  color: #ffffff;
}

/* App content area */
.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

/* Scrollbars */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--thumb-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--thumb-hover);
}
```

---

### CREATE `src/renderer/main.tsx`

- **IMPLEMENT**: React 18 entry point using `createRoot`. Imports styles.css.
- **GOTCHA**: Use `ReactDOM.createRoot`, not `ReactDOM.render` (deprecated in React 18)
- **VALIDATE**: `npm run dev` — React app renders in window

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

### CREATE `src/renderer/App.tsx`

- **IMPLEMENT**: Root component. Manages theme state, applies `data-theme` to `document.documentElement`, listens to IPC `theme-changed` events, renders titlebar + placeholder layout matching PRD section 9 mock.
- **PATTERN**: `.claude/skills/react-components/SKILL.md` — functional component, typed props, no React.FC<>
- **GOTCHA**: Call `window.api.onThemeChanged(cb)` and return cleanup in useEffect
- **GOTCHA**: Manual theme toggle must persist to `localStorage`
- **VALIDATE**: Dark/light toggle button changes colors; titlebar minimize/close buttons work

```typescript
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes via IPC
  useEffect(() => {
    const cleanup = window.api.onThemeChanged((newTheme: Theme) => {
      setTheme(newTheme)
    })
    return cleanup
  }, [])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  function handleMinimize() {
    window.api.minimize()
  }

  function handleClose() {
    window.api.close()
  }

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-title">VoiceToText</span>
        <div className="titlebar-controls">
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleMinimize} title="Minimize">−</button>
          <button className="btn-close" onClick={handleClose} title="Close">✕</button>
        </div>
      </div>

      <div className="app-content">
        {/* Phase 2+: Model setup screen / main widget will replace this placeholder */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          Phase 1 scaffold — ready for feature implementation.
        </p>
      </div>
    </>
  )
}
```

---

### CREATE `src/types/electron.d.ts`

- **IMPLEMENT**: Augment the global `Window` interface so TypeScript knows about `window.api` in the renderer without importing from preload
- **GOTCHA**: This file must be in `tsconfig.web.json`'s `include` — `src/types/**/*` covers it
- **VALIDATE**: `npx tsc --noEmit` — no "Property 'api' does not exist on type 'Window'" errors

```typescript
import type { ElectronAPI } from '../preload/index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

---

### CREATE `src/preload/index.ts`

- **IMPLEMENT**: contextBridge.exposeInMainWorld with full `window.api` skeleton. Export the type as `ElectronAPI` for use in `electron.d.ts`.
- **PATTERN**: CLAUDE.md IPC pattern — all bridge methods here, no business logic
- **GOTCHA**: `ipcRenderer.on` listeners must return a cleanup function (call `ipcRenderer.removeListener` or `removeAllListeners` for that channel)
- **GOTCHA**: Never expose raw `ipcRenderer` — only specific typed methods
- **VALIDATE**: App launches without "contextBridge" or "ipcRenderer" console errors

```typescript
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
```

---

### DELETE `src/index.ts`

- **IMPLEMENT**: Remove the old placeholder entry point — it conflicts with the new `src/main/index.ts`
- **VALIDATE**: `ls src/` — `index.ts` should not exist; `src/main/`, `src/renderer/`, `src/preload/` should exist

---

### VALIDATE Full Build

- **VALIDATE**: `npm run dev` — Electron window opens at 340×280px, frameless, dark mode by default
- **VALIDATE**: Titlebar visible, drag works, minimize button minimizes, close button closes
- **VALIDATE**: Theme toggle button switches between dark and light mode
- **VALIDATE**: `npm run build` — exits 0, no TypeScript errors
- **VALIDATE**: `npx tsc --noEmit` — zero errors in strict mode

---

## TESTING STRATEGY

### Manual Validation (Phase 1 — no unit tests yet)

Phase 1 is infrastructure; no business logic to unit test. All validation is manual and build-time.

### Edge Cases to Check Manually

- Theme flash on startup: should apply theme before window shows (handled by `ready-to-show`)
- `localStorage` persists theme across restarts: close and reopen app, theme should be remembered
- Minimize + close buttons respond to click (not blocked by `-webkit-app-region: drag`)
- Window is not resizable (user cannot drag edges)
- `npm run build` produces `dist/main/index.js`, `dist/preload/index.js`, `dist/renderer/index.html`

---

## VALIDATION COMMANDS

### Level 1: TypeScript

```bash
npx tsc --noEmit
```

### Level 2: Build

```bash
npm run build
```

### Level 3: Dev Run

```bash
npm run dev
```

Expected: Electron window opens, 340×280px, frameless, dark background (#1e1e2e), custom titlebar visible.

### Level 4: Manual Checks

- [ ] Window is exactly 340×280 (check via Window > Properties or Electron devtools)
- [ ] Title bar area is draggable (hold and drag window)
- [ ] Minimize button minimizes window
- [ ] Close button closes app
- [ ] Theme toggle switches colors instantly (no flash)
- [ ] localStorage `theme` key is set after toggle
- [ ] Relaunch app — theme is restored from localStorage

---

## ACCEPTANCE CRITERIA

- [ ] `npm install` completes without errors
- [ ] `npm run build` exits 0 with no TypeScript errors
- [ ] `npm run dev` launches Electron window — no console errors
- [ ] Window dimensions: 340×280px, not resizable
- [ ] Window is frameless (no OS titlebar visible)
- [ ] Custom titlebar is visible and draggable
- [ ] Minimize and close buttons function correctly
- [ ] Dark mode is the default theme; colors match `#1e1e2e` background
- [ ] Theme toggle works; persists across restarts via localStorage
- [ ] `window.api` is accessible in renderer without TypeScript errors
- [ ] All preload methods are typed via `ElectronAPI` — no `any` in window.api
- [ ] `contextIsolation: true` — no Node APIs leak into renderer
- [ ] No `nodeIntegration: true` — security constraint from CLAUDE.md

---

## COMPLETION CHECKLIST

- [ ] package.json replaced with full dependency list
- [ ] electron.vite.config.ts created
- [ ] tsconfig.json, tsconfig.node.json, tsconfig.web.json in place
- [ ] electron-builder.yml created
- [ ] npm install ran successfully
- [ ] src/main/index.ts created
- [ ] src/main/ipc.ts created
- [ ] src/renderer/index.html created
- [ ] src/renderer/styles.css created (full CSS variable system)
- [ ] src/renderer/main.tsx created
- [ ] src/renderer/App.tsx created (theme IPC + layout shell)
- [ ] src/preload/index.ts created (contextBridge + ElectronAPI type export)
- [ ] src/types/electron.d.ts created (Window interface augmentation)
- [ ] src/index.ts deleted
- [ ] All validation commands pass
- [ ] Manual checks completed

---

## NOTES

- **electron-vite + tsconfig**: electron-vite strongly recommends a split tsconfig strategy (node vs web). The `@electron-toolkit/tsconfig` package provides base configs but can be replaced with manual configs as shown above if preferred — both approaches work.
- **nativeTheme timing**: Send theme in `ready-to-show`, not `did-finish-load` — `ready-to-show` fires after paint is ready, avoiding a white flash before theme applies.
- **Emoji in titlebar**: The theme toggle uses emoji (☀️/🌙). This is intentional for Phase 1 simplicity. Phase 5 (polish) should replace with proper SVG icons.
- **whisper binary**: `electron-builder.yml` includes `extraResources` for `resources/whisper/` even though the binary doesn't exist yet — this is forward-compatible and won't break the build if the directory is missing.
- **`resources/whisper/` directory**: Create an empty `resources/whisper/.gitkeep` if it doesn't exist, to preserve the directory in git.

**Confidence Score: 8/10** — The scaffold pattern is well-established with electron-vite. The main risk is tsconfig configuration for the multi-process setup; the alternative manual tsconfig provided above avoids `@electron-toolkit/tsconfig` dependency if that package causes issues.
