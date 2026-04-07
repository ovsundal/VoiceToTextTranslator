# Feature: Phase 2 — Model Management

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to:
- Shared types between main and renderer — types live in `src/types/`, imported in both processes
- IPC channel names — must match exactly between `ipc.ts`, `preload/index.ts`, and renderer
- axios streaming download — `responseType: 'stream'` in main process, not renderer
- Temp file pattern for downloads — write to `.tmp`, rename on success to avoid partial files

## Feature Description

Implement the model management subsystem: a `modelManager.ts` module in the main process that lists, downloads, and verifies whisper.cpp GGUF models stored in `userData/models/`. Add a first-launch detection flow in the React app that shows a model picker screen when no model is present, streams download progress to the UI, and transitions to the main widget placeholder on completion.

## User Story

As a user launching VoiceToText Translator for the first time,
I want to be prompted to choose and download a Whisper model,
So that the app is ready to transcribe without requiring any manual file management.

## Problem Statement

The app currently shows a Phase 1 placeholder with no models and no way to acquire them. whisper.cpp cannot transcribe without a model file. Users need a guided setup experience that selects a model, downloads it with visible progress, and enters the main UI when ready.

## Solution Statement

Add `modelManager.ts` to the main process to manage GGUF model files in `userData/models/`. Wire IPC handlers for `listModels` and `downloadModel` (with streaming progress events). In the renderer, replace the placeholder with a conditional: if no model exists → show `<ModelSetup />` (model picker + progress bar); once a model downloads → transition to the main widget stub.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: Main process (modelManager, ipc), Preload (contextBridge), Renderer (App, ModelSetup component)
**Dependencies**: `axios` (add to package.json — not yet installed)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/main/ipc.ts` — All IPC handlers live here; Phase 2 stubs already present as comments (lines 8-14)
- `src/preload/index.ts` — contextBridge skeleton; Phase 2 stubs at lines 19-22
- `src/renderer/App.tsx` — Root component; replace placeholder at lines 49-53 with conditional render
- `src/types/electron.d.ts` — Window interface augmentation; updates automatically via ElectronAPI re-export
- `tsconfig.node.json` — Must add `src/types/**/*` to include so main process can import shared types

### New Files to Create

- `src/types/models.ts` — `ModelSize`, `ModelInfo`, `DownloadProgress` shared type definitions
- `src/main/modelManager.ts` — `listModels()`, `downloadModel()`, `getModelsDir()` implementation
- `src/renderer/components/ModelSetup.tsx` — First-launch UI: model picker list + download progress bar

### Relevant Documentation — READ THESE BEFORE IMPLEMENTING

- [axios streaming docs](https://axios-http.com/docs/req_config) — `responseType: 'stream'` config for Node.js download
- [Electron app.getPath](https://www.electronjs.org/docs/latest/api/app#appgetpathname) — `userData` path for model storage
- [Node.js fs.createWriteStream](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) — stream piping for download
- [Hugging Face ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) — Model file URLs and sizes

### Patterns to Follow

**IPC Pattern (from CLAUDE.md + src/main/ipc.ts):**
- `ipcMain.handle` for request/response (listModels → returns data)
- `ipcMain.on` for fire-and-forget with streaming side channel (downloadModel → progress via webContents.send)
- All handlers in `ipc.ts`, never in `index.ts`

**contextBridge Pattern (from src/preload/index.ts):**
```typescript
// Existing pattern to mirror:
onThemeChanged: (cb: (theme: 'dark' | 'light') => void) => {
  const handler = (_: Electron.IpcRendererEvent, theme: 'dark' | 'light') => cb(theme)
  ipcRenderer.on('theme-changed', handler)
  return () => ipcRenderer.removeListener('theme-changed', handler)
},
```

**Component Pattern (from react-components/SKILL.md):**
```typescript
// Props interface + direct function typing, no React.FC<>
interface ModelSetupProps {
  onComplete: () => void
}
export default function ModelSetup({ onComplete }: ModelSetupProps) { ... }
```

**CSS variables (from src/renderer/styles.css):**
All new UI elements must use `var(--bg)`, `var(--text)`, `var(--accent)`, `var(--border)` etc — no hardcoded colors.

---

## IMPLEMENTATION PLAN

### Phase 1: Shared Types + Config

Define shared types and add axios dependency before any other work.

**Tasks:**
- Create `src/types/models.ts` with `ModelSize`, `ModelInfo`, `DownloadProgress`
- Add `src/types/**/*` to `tsconfig.node.json` includes
- Add `axios` to `package.json` dependencies + run `npm install`

### Phase 2: Main Process — modelManager.ts

Implement the model file management module.

**Tasks:**
- Create `src/main/modelManager.ts` with `listModels()`, `downloadModel()`, `getModelsDir()`
- Model URLs from `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{size}.bin`
- Download pattern: stream to `{name}.tmp` → rename to `{name}.bin` on success

### Phase 3: IPC Wiring

Connect modelManager to renderer via IPC.

**Tasks:**
- Update `src/main/ipc.ts` — implement `listModels` handle + `downloadModel` on
- Update `src/preload/index.ts` — implement `listModels`, `downloadModel`, `onDownloadProgress`

### Phase 4: Renderer UI

Build the model setup screen and wire it into App.tsx.

**Tasks:**
- Create `src/renderer/components/ModelSetup.tsx` — model picker + progress bar
- Update `src/renderer/App.tsx` — first-launch check, conditional render
- Update `src/renderer/styles.css` — progress bar + model setup styles

---

## STEP-BY-STEP TASKS

### CREATE `src/types/models.ts`

- **IMPLEMENT**: Shared type definitions for model data structures — no runtime code, types only
- **GOTCHA**: `ModelSize` must be a union type literal (not enum) — used as object keys and string comparisons
- **VALIDATE**: `npm run build` — no type errors

```typescript
export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface ModelInfo {
  size: ModelSize
  label: string           // Human readable: "Tiny (75 MB)"
  fileName: string        // "ggml-tiny.bin"
  fileSizeBytes: number   // Expected size for integrity check
  downloaded: boolean     // Whether file exists in userData/models/
  path?: string           // Full path if downloaded
}

export interface DownloadProgress {
  size: ModelSize
  percent: number           // 0–100
  bytesDownloaded: number
  totalBytes: number
  speedBytesPerSec: number
  status: 'downloading' | 'complete' | 'error'
  error?: string
}
```

---

### UPDATE `tsconfig.node.json`

- **IMPLEMENT**: Add `src/types/**/*` to `include` array so main process and preload can import shared types
- **GOTCHA**: Without this, `import type { ModelSize } from '../types/models'` in `modelManager.ts` will fail

**Change**: Add `"src/types/**/*"` to the `include` array alongside existing entries.

- **VALIDATE**: `npm run build` — no "Cannot find module" errors in main process

---

### ADD `axios` to `package.json`

- **IMPLEMENT**: Add `"axios": "^1.7.0"` to `dependencies` (not devDependencies — needed at runtime in main process)
- **VALIDATE**: `npm install && ls node_modules/axios` — package present

---

### CREATE `src/main/modelManager.ts`

- **IMPLEMENT**: Model directory management, listing existing models, downloading with progress streaming
- **PATTERN**: Binary path pattern from CLAUDE.md — resolve paths relative to known Electron dirs
- **GOTCHA**: Download must use `responseType: 'stream'` in axios config — browser-mode streaming won't work in Node context
- **GOTCHA**: Write to `{file}.tmp` first, rename to final name only on full success — prevents corrupt partial files being detected as valid
- **GOTCHA**: `app.getPath('userData')` only available after `app.whenReady()` — never call at module load time; always call inside functions
- **VALIDATE**: `npm run build` — compiles without errors

```typescript
import { app } from 'electron'
import { existsSync, mkdirSync, renameSync, unlinkSync, statSync } from 'fs'
import { createWriteStream } from 'fs'
import { join } from 'path'
import axios from 'axios'
import type { ModelSize, ModelInfo, DownloadProgress } from '../types/models'

const MODEL_META: Record<ModelSize, { label: string; fileName: string; fileSizeBytes: number; url: string }> = {
  tiny:   { label: 'Tiny (75 MB)',    fileName: 'ggml-tiny.bin',     fileSizeBytes:    75_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin' },
  base:   { label: 'Base (142 MB)',   fileName: 'ggml-base.bin',     fileSizeBytes:   142_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' },
  small:  { label: 'Small (466 MB)',  fileName: 'ggml-small.bin',    fileSizeBytes:   466_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' },
  medium: { label: 'Medium (1.5 GB)', fileName: 'ggml-medium.bin',   fileSizeBytes: 1_500_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin' },
  large:  { label: 'Large (3.1 GB)',  fileName: 'ggml-large-v3.bin', fileSizeBytes: 3_100_000_000, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin' },
}

export function getModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listModels(): ModelInfo[] {
  const dir = getModelsDir()
  return (Object.keys(MODEL_META) as ModelSize[]).map(size => {
    const meta = MODEL_META[size]
    const filePath = join(dir, meta.fileName)
    const downloaded = existsSync(filePath) &&
      statSync(filePath).size >= meta.fileSizeBytes * 0.99  // allow 1% tolerance
    return {
      size,
      label: meta.label,
      fileName: meta.fileName,
      fileSizeBytes: meta.fileSizeBytes,
      downloaded,
      path: downloaded ? filePath : undefined,
    }
  })
}

export async function downloadModel(
  size: ModelSize,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const meta = MODEL_META[size]
  const dir = getModelsDir()
  const finalPath = join(dir, meta.fileName)
  const tmpPath = `${finalPath}.tmp`

  const startTime = Date.now()
  let lastBytes = 0

  try {
    const response = await axios.get(meta.url, {
      responseType: 'stream',
      headers: { 'User-Agent': 'VoiceToTextTranslator/1.0' },
    })

    const totalBytes = parseInt(response.headers['content-length'] ?? '0', 10) || meta.fileSizeBytes
    const writer = createWriteStream(tmpPath)
    let bytesDownloaded = 0

    response.data.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length
      const now = Date.now()
      const elapsed = (now - startTime) / 1000
      const speedBytesPerSec = elapsed > 0 ? Math.round(bytesDownloaded / elapsed) : 0
      const percent = Math.round((bytesDownloaded / totalBytes) * 100)

      onProgress({ size, percent, bytesDownloaded, totalBytes, speedBytesPerSec, status: 'downloading' })
      lastBytes = bytesDownloaded
    })

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
      response.data.on('error', reject)
      response.data.pipe(writer)
    })

    renameSync(tmpPath, finalPath)
    onProgress({ size, percent: 100, bytesDownloaded: lastBytes, totalBytes, speedBytesPerSec: 0, status: 'complete' })
  } catch (err) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
    const message = err instanceof Error ? err.message : String(err)
    onProgress({ size, percent: 0, bytesDownloaded: 0, totalBytes: meta.fileSizeBytes, speedBytesPerSec: 0, status: 'error', error: message })
    throw err
  }
}
```

---

### UPDATE `src/main/ipc.ts`

- **IMPLEMENT**: Add `listModels` handle and `downloadModel` on-handler; remove the TODO comment stubs
- **PATTERN**: `ipcMain.handle` for sync-style request/response; `ipcMain.on` for fire-and-forget with side-channel progress events
- **GOTCHA**: `downloadModel` must be `ipcMain.on` (not handle) because progress streams back via `webContents.send`, not a return value
- **VALIDATE**: `npm run build` — no errors

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { listModels, downloadModel } from './modelManager'

export function registerIpcHandlers(win: BrowserWindow): void {
  // Titlebar controls
  ipcMain.on('minimize', () => win.minimize())
  ipcMain.on('close', () => win.close())

  // Model management
  ipcMain.handle('listModels', () => listModels())

  ipcMain.on('downloadModel', (_, size: string) => {
    downloadModel(size as import('../types/models').ModelSize, (progress) => {
      win.webContents.send('download-progress', progress)
    }).catch(console.error)
  })

  // TODO Phase 3: transcribe handler
  // ipcMain.handle('transcribe', async (_, wavPath: string, language: string) => { ... })

  // TODO Phase 4: clipboard
  // ipcMain.handle('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })
}
```

---

### UPDATE `src/preload/index.ts`

- **IMPLEMENT**: Implement `listModels`, `downloadModel`, `onDownloadProgress` — replace TODO comments with real methods
- **PATTERN**: Mirror existing `onThemeChanged` pattern for `onDownloadProgress` (listener + cleanup)
- **GOTCHA**: `listModels` returns a Promise — use `ipcRenderer.invoke`, not `send`
- **GOTCHA**: `downloadModel` fires-and-forgets — use `ipcRenderer.send`, not `invoke`
- **IMPORTS**: Import `ModelInfo`, `DownloadProgress`, `ModelSize` from `../types/models` — but this is node-side code, so use `import type`
- **VALIDATE**: `npm run build` — `ElectronAPI` type now includes the new methods with no `any`

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { ModelInfo, ModelSize, DownloadProgress } from '../types/models'

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

  // Model management
  listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('listModels'),
  downloadModel: (size: ModelSize): void => ipcRenderer.send('downloadModel', size),
  onDownloadProgress: (cb: (progress: DownloadProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: DownloadProgress) => cb(progress)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },

  // TODO Phase 3: transcription
  // transcribe: (wavPath: string, language: 'en' | 'no'): Promise<string> =>
  //   ipcRenderer.invoke('transcribe', wavPath, language),

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

### CREATE `src/renderer/components/ModelSetup.tsx`

- **IMPLEMENT**: Full first-launch screen. Lists all 5 model options, allows selection, triggers download on confirm, shows progress bar with percent/speed, calls `onComplete` when download finishes.
- **PATTERN**: react-components/SKILL.md — `interface` for props, no `React.FC<>`, `useEffect` with cleanup
- **PATTERN**: CSS variables from styles.css — `var(--bg)`, `var(--accent)`, etc. — no hardcoded colors
- **GOTCHA**: `onDownloadProgress` returns a cleanup function — call it in `useEffect` return
- **GOTCHA**: After download `status === 'complete'`, call `onComplete()` to transition App state
- **VALIDATE**: `npm run build` — component compiles; `npm run dev` — setup screen renders on first launch

```typescript
import { useEffect, useState } from 'react'
import type { ModelSize, ModelInfo, DownloadProgress } from '../../../src/types/models'

// Note: path alias @renderer maps to src/renderer, so use relative import
// OR use: import type { ... } from '../../types/models'

interface ModelSetupProps {
  onComplete: () => void
}

export default function ModelSetup({ onComplete }: ModelSetupProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selected, setSelected] = useState<ModelSize>('base')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    window.api.listModels().then(setModels)
  }, [])

  useEffect(() => {
    if (!isDownloading) return
    const cleanup = window.api.onDownloadProgress((p) => {
      setProgress(p)
      if (p.status === 'complete') {
        setIsDownloading(false)
        onComplete()
      }
      if (p.status === 'error') {
        setIsDownloading(false)
      }
    })
    return cleanup
  }, [isDownloading, onComplete])

  function handleDownload() {
    setIsDownloading(true)
    setProgress(null)
    window.api.downloadModel(selected)
  }

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }

  return (
    <div className="setup-screen">
      <p className="setup-title">Choose a transcription model</p>

      <div className="model-list">
        {models.map((m) => (
          <label key={m.size} className={`model-option ${selected === m.size ? 'selected' : ''}`}>
            <input
              type="radio"
              name="model"
              value={m.size}
              checked={selected === m.size}
              onChange={() => setSelected(m.size)}
              disabled={isDownloading}
            />
            <span className="model-label">{m.label}</span>
            {m.downloaded && <span className="model-badge">✓</span>}
          </label>
        ))}
      </div>

      {!isDownloading && (
        <button className="btn-primary" onClick={handleDownload}>
          Download
        </button>
      )}

      {isDownloading && progress && (
        <div className="progress-area">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="progress-meta">
            <span>{progress.percent}%</span>
            <span>{formatSpeed(progress.speedBytesPerSec)}</span>
          </div>
          {progress.status === 'error' && (
            <p className="progress-error">{progress.error ?? 'Download failed'}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

**Note on import path**: Use `import type { ModelSize, ModelInfo, DownloadProgress } from '../../types/models'` (relative from `src/renderer/components/`).

---

### UPDATE `src/renderer/App.tsx`

- **IMPLEMENT**: Add first-launch detection. On mount call `window.api.listModels()`. If no downloaded model exists → render `<ModelSetup />`. When setup completes → render main widget stub (Phase 3 placeholder).
- **PATTERN**: `appState: 'loading' | 'setup' | 'ready'` — three states, not a boolean, to handle the loading flicker
- **GOTCHA**: Show nothing (or a spinner) during `loading` state to avoid flash of wrong screen
- **VALIDATE**: `npm run dev` — shows setup screen on first launch; shows main content after a model is downloaded

```typescript
import { useEffect, useState } from 'react'
import ModelSetup from './components/ModelSetup'

type Theme = 'dark' | 'light'
type AppState = 'loading' | 'setup' | 'ready'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })
  const [appState, setAppState] = useState<AppState>('loading')

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

  // Check if a model is available
  useEffect(() => {
    window.api.listModels().then((models) => {
      const hasModel = models.some((m) => m.downloaded)
      setAppState(hasModel ? 'ready' : 'setup')
    })
  }, [])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-title">VoiceToText</span>
        <div className="titlebar-controls">
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => window.api.minimize()} title="Minimize">−</button>
          <button className="btn-close" onClick={() => window.api.close()} title="Close">✕</button>
        </div>
      </div>

      <div className="app-content">
        {appState === 'loading' && null}
        {appState === 'setup' && (
          <ModelSetup onComplete={() => setAppState('ready')} />
        )}
        {appState === 'ready' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Phase 2 complete — model ready. Recording UI coming in Phase 3.
          </p>
        )}
      </div>
    </>
  )
}
```

---

### UPDATE `src/renderer/styles.css`

- **IMPLEMENT**: Add styles for `.setup-screen`, `.model-list`, `.model-option`, `.model-badge`, `.btn-primary`, `.progress-area`, `.progress-bar-track`, `.progress-bar-fill`, `.progress-meta`, `.progress-error`
- **PATTERN**: All colors via CSS variables — no hardcoded hex values
- **VALIDATE**: `npm run dev` — setup screen is styled; progress bar animates during download

```css
/* Model Setup Screen */
.setup-screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.setup-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 4px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 100ms ease-out;
}

.model-option:hover {
  background: var(--bg-secondary);
}

.model-option.selected {
  background: var(--bg-secondary);
  border-color: var(--accent);
}

.model-option input[type="radio"] {
  accent-color: var(--accent);
  cursor: pointer;
}

.model-label {
  font-size: 12px;
  color: var(--text);
  flex: 1;
}

.model-badge {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
}

/* Primary Button */
.btn-primary {
  width: 100%;
  padding: 8px;
  background: var(--accent);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 150ms ease-out, transform 100ms ease-out;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Download Progress */
.progress-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 200ms linear;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.progress-error {
  font-size: 11px;
  color: var(--accent-danger);
  margin: 0;
}
```

---

### VALIDATE Full Build

- **VALIDATE**: `npm run build` — exits 0, no TypeScript errors in any process
- **VALIDATE**: `npm run dev` — Electron window opens; setup screen visible on first launch
- **VALIDATE**: Model list renders with 5 options; radio selection works
- **VALIDATE**: Clicking Download starts progress bar (visible during download)
- **VALIDATE**: After download completes, screen transitions to "Phase 2 complete" state
- **VALIDATE**: Relaunching app after download → goes directly to ready state (skips setup)

---

## TESTING STRATEGY

### Manual Validation (Phase 2 — no unit tests yet)

Phase 2 involves file I/O and network; meaningful tests require mocking Electron's `app` module and axios. These are better added in a dedicated test phase. All validation here is manual + build-time.

### Edge Cases to Check Manually

- **First launch** (no models dir): setup screen shows, all 5 models listed as not downloaded
- **Subsequent launch** (model exists): setup screen skipped, goes directly to ready state
- **Download cancellation** (close app mid-download): temp `.tmp` file should be cleaned up on next download attempt
- **Network error mid-download**: error message appears in progress area, download button re-enables
- **Model already downloaded** (shown with `✓` badge): can still re-download by selecting and clicking Download
- **All 5 model options** render correctly with correct labels and sizes

---

## VALIDATION COMMANDS

### Level 1: Build

```bash
npm run build
```

Expected: exits 0, three bundles built (main, preload, renderer).

### Level 2: TypeScript strict check

```bash
npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json
```

Expected: zero errors in both configs.

### Level 3: Dev Run

```bash
npm run dev
```

Expected: Electron window shows model setup screen on first launch.

### Level 4: Manual Checks

- [ ] Setup screen visible with all 5 model options
- [ ] Radio button selection highlights selected model
- [ ] "Download" button triggers download and shows progress bar
- [ ] Progress bar fills and shows download speed
- [ ] After completion, transitions to main widget stub
- [ ] Relaunching shows main widget stub directly (model persists)
- [ ] Model `.bin` file exists in `%APPDATA%/VoiceToText Translator/models/`

---

## ACCEPTANCE CRITERIA

- [ ] `npm run build` exits 0 with no TypeScript errors
- [ ] `npm run dev` shows model setup screen on first launch
- [ ] All 5 model sizes listed with correct labels and file sizes
- [ ] Download starts when "Download" is clicked, progress bar is visible
- [ ] Download progress updates smoothly (percent + speed shown)
- [ ] On completion, app transitions to main widget placeholder
- [ ] Relaunch after download skips setup (model detected in userData)
- [ ] Download error is displayed in UI (not silent)
- [ ] `.tmp` file pattern prevents corrupt partial files from being detected as valid
- [ ] `window.api` is fully typed — no `any` in `ElectronAPI`
- [ ] No hardcoded colors in new CSS — all use CSS variables

---

## COMPLETION CHECKLIST

- [ ] `src/types/models.ts` created with `ModelSize`, `ModelInfo`, `DownloadProgress`
- [ ] `tsconfig.node.json` updated to include `src/types/**/*`
- [ ] `axios` added to `package.json` and installed
- [ ] `src/main/modelManager.ts` created
- [ ] `src/main/ipc.ts` updated with `listModels` + `downloadModel` handlers
- [ ] `src/preload/index.ts` updated with typed `listModels`, `downloadModel`, `onDownloadProgress`
- [ ] `src/renderer/components/ModelSetup.tsx` created
- [ ] `src/renderer/App.tsx` updated with loading/setup/ready state machine
- [ ] `src/renderer/styles.css` updated with setup + progress bar styles
- [ ] All validation commands pass
- [ ] Manual checks completed

---

## NOTES

- **Model file format**: The PRD says "GGUF format" but whisper.cpp models from `ggerganov/whisper.cpp` on Hugging Face are actually `.bin` format (legacy GGML format). The filenames are `ggml-{size}.bin`. This is correct for the prebuilt `main.exe` binary. Do not use `.gguf` extension.
- **large model naming**: The large model is `ggml-large-v3.bin` (not `ggml-large.bin`) — the v3 variant is the current recommended large model.
- **Window height**: The PRD mentions "expands slightly during model setup." For Phase 2, the setup screen is designed to fit within the existing 340×280px window. Height adjustment can be added in Phase 5 polish.
- **Download from Hugging Face**: HuggingFace sometimes returns 302 redirects. axios follows redirects by default — no extra config needed.
- **userData path on Windows**: Resolves to `C:\Users\{user}\AppData\Roaming\VoiceToText Translator\models\`. The `appId` in `electron-builder.yml` determines the folder name in production; in dev it uses the app name from `package.json`.
- **Cancellation**: No cancel support in Phase 2. The download runs to completion or error. Cancellation (using an axios `CancelToken` or `AbortController`) can be added in Phase 5 if needed.

**Confidence Score: 9/10** — Well-understood patterns (axios streaming, Electron IPC, React state machines). Main risk is the HuggingFace URL structure for model files — verify the exact filenames before executing, as they occasionally change between whisper.cpp versions.
