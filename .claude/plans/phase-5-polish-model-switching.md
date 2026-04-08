# Feature: Phase 5 — Polish, Model Switching & Packaging

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing types and IPC channel names. Import from the right files.

---

## Feature Description

Phase 5 closes the loop on the MVP:
1. **Model management from within the app** — a Settings Panel (gear icon in titlebar) lets users download additional models, delete downloaded models to free disk space, and switch the active model — without having to go through the one-time setup screen again.
2. **UI polish** — animated status transitions, better empty/loading states, consistent error recovery.
3. **Packaging validation** — confirm `electron-builder` produces a working NSIS installer with the whisper.cpp binary correctly bundled.

---

## User Story

As a user
I want to download, delete, and switch whisper models from within the app
So that I can balance transcription quality vs. speed without reinstalling anything

---

## Problem Statement

After the first-launch setup, users have no way to:
- Download additional models (e.g. upgrade from tiny → small)
- Delete large models they no longer want
- Change the active model without restarting or hacking a dropdown

The model dropdown in RecordingWidget already filters to *downloaded* models only, but there's no path to get more models downloaded post-setup.

---

## Solution Statement

Add a **Settings Panel** behind a gear icon in the titlebar. When opened, it replaces the main widget content with a model management screen: all 5 models listed, each with download status, file size, a Download / Delete action button, and a "Use this model" radio selection. The selected model is persisted to `localStorage` so it survives restarts.

Additionally, add a `deleteModel` IPC channel on the main side, and polish a handful of UI rough edges.

---

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `ipc.ts`, `modelManager.ts`, `preload/index.ts`, `App.tsx`, new `SettingsPanel.tsx`, `RecordingWidget.tsx`, `styles.css`  
**Dependencies**: No new npm packages required

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/main/modelManager.ts` — Full file. Contains `listModels()`, `downloadModel()`, and `getModelsDir()`. You will add `deleteModel(size)` here.
- `src/main/ipc.ts` — Full file. All `ipcMain.handle`/`.on` registrations live here. Add new channels here only.
- `src/preload/index.ts` — Full file. The `contextBridge.exposeInMainWorld` surface. Add new API methods here to match new IPC channels.
- `src/renderer/App.tsx` — Full file. Controls `appState` ('loading' | 'setup' | 'ready') and theme. Add `settingsOpen` state and gear-icon button here.
- `src/renderer/components/ModelSetup.tsx` — Full file. Template for the model list UI pattern (radio selection, download button, progress bar). SettingsPanel mirrors this pattern.
- `src/renderer/components/RecordingWidget.tsx` — Full file. Toolbar with language + model dropdowns. Will receive callback to open settings.
- `src/renderer/hooks/useRecorder.ts` — Full file. All recording business logic. Read to understand `downloadedModels` state refresh.
- `src/renderer/styles.css` — Full file. All CSS variables, component classes. Add `.settings-panel`, `.model-row`, `.model-row-actions` classes here.

### New Files to Create

- `src/renderer/components/SettingsPanel.tsx` — Model management UI (list all 5 models, download/delete actions, active model selection)

### Relevant Documentation

No new external libraries needed. Patterns already exist in codebase.

---

## Patterns to Follow

### IPC Pattern
```typescript
// Main side (ipc.ts) — one-way fire-and-forget with side-effects:
ipcMain.on('deleteModel', async (_event, size: ModelSize) => {
  await deleteModel(size)
})

// Main side (ipc.ts) — request/response:
ipcMain.handle('someQuery', async () => { return result })

// Preload (index.ts) — expose to renderer:
deleteModel: (size: ModelSize) => ipcRenderer.send('deleteModel', size),
```

### CSS Variable Pattern
```css
/* New component classes follow existing BEM-like pattern */
.settings-panel { /* screen-level container */ }
.model-row { /* one row per model */ }
.model-row-info { /* label + size text */ }
.model-row-actions { /* buttons on right side */ }
```

### Cleanup Pattern for IPC Listeners
```typescript
// All onXxx() calls in preload return cleanup function:
onDownloadProgress: (cb) => {
  const handler = (_: IpcRendererEvent, progress: DownloadProgress) => cb(progress)
  ipcRenderer.on('download-progress', handler)
  return () => ipcRenderer.removeListener('download-progress', handler)
},
```

### Model State Refresh Pattern
After any download/delete action, call `window.api.listModels()` again and update local state. This is the same pattern as `ModelSetup.tsx` on mount.

### localStorage Key Pattern
`localStorage.getItem('selectedModelSize')` is already used in `useRecorder.ts` to persist model preference. Keep using this key for the settings panel active model selection.

---

## IMPLEMENTATION PLAN

### Phase 1: Main Process — deleteModel

Add delete capability to the backend before touching UI.

### Phase 2: Preload — Expose deleteModel

Surface the new IPC channel to the renderer.

### Phase 3: SettingsPanel Component

Build the model management UI as a new component.

### Phase 4: App.tsx — Wire Settings into Layout

Add gear icon to titlebar, `settingsOpen` state, and conditional render.

### Phase 5: RecordingWidget — Sync After Settings Close

After closing settings, reload downloaded models in useRecorder.

### Phase 6: UI Polish

Transitions, loading states, error recovery improvements.

### Phase 7: Packaging Validation

Confirm electron-builder produces working installer.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `src/main/modelManager.ts`

- **ADD** `deleteModel(size: ModelSize): Promise<void>` function at the bottom of the file
- **IMPLEMENT**:
  ```typescript
  export async function deleteModel(size: ModelSize): Promise<void> {
    const dir = getModelsDir()
    const fileName = MODEL_META[size].fileName
    const filePath = path.join(dir, fileName)
    const tmpPath = filePath + '.tmp'
    // Delete final file if it exists
    try { await fs.promises.unlink(filePath) } catch {}
    // Also clean up any partial download
    try { await fs.promises.unlink(tmpPath) } catch {}
  }
  ```
- **PATTERN**: `getModelsDir()` pattern at top of file, `path.join` for file paths
- **GOTCHA**: Silently ignore `ENOENT` errors (file may not exist). Wrap each `unlink` independently so partial-download cleanup doesn't block final-file cleanup.
- **VALIDATE**: `npm run build` (TypeScript should compile with no errors)

---

### Task 2: UPDATE `src/main/ipc.ts`

- **ADD** import of `deleteModel` alongside existing imports from `modelManager`
- **ADD** new IPC handler inside `registerIpcHandlers`:
  ```typescript
  ipcMain.on('deleteModel', async (_event, size: ModelSize) => {
    await deleteModel(size)
  })
  ```
- **PATTERN**: Mirror the `ipcMain.on('downloadModel', ...)` handler above it
- **GOTCHA**: Use `.on()` not `.handle()` — delete is fire-and-forget, no return value needed
- **VALIDATE**: `npm run build`

---

### Task 3: UPDATE `src/preload/index.ts`

- **ADD** `deleteModel` to the `ElectronAPI` type and implementation:
  ```typescript
  // In the type definition:
  deleteModel: (size: ModelSize) => void

  // In the implementation:
  deleteModel: (size: ModelSize) => ipcRenderer.send('deleteModel', size),
  ```
- **PATTERN**: Mirror `downloadModel: (size) => ipcRenderer.send('downloadModel', size)`
- **VALIDATE**: `npm run build` — TypeScript checks that implementation matches type

---

### Task 4: CREATE `src/renderer/components/SettingsPanel.tsx`

This is the main new UI component. It shows all 5 models (downloaded and not), and lets users download, delete, and set the active model.

- **IMPLEMENT** the full component:

```tsx
import { useState, useEffect, useRef } from 'react'
import type { ModelInfo, ModelSize, DownloadProgress } from '../../types/models'

interface SettingsPanelProps {
  currentModelSize: ModelSize
  onModelChange: (size: ModelSize) => void
  onClose: () => void
}

export function SettingsPanel({ currentModelSize, onModelChange, onClose }: SettingsPanelProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [downloading, setDownloading] = useState<ModelSize | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const refreshModels = async () => {
    const list = await window.api.listModels()
    setModels(list)
  }

  useEffect(() => {
    refreshModels()
    return () => { cleanupRef.current?.() }
  }, [])

  const handleDownload = (size: ModelSize) => {
    setDownloading(size)
    setError(null)
    window.api.downloadModel(size)
    cleanupRef.current = window.api.onDownloadProgress((p) => {
      setProgress(p)
      if (p.status === 'complete') {
        setDownloading(null)
        setProgress(null)
        cleanupRef.current?.()
        refreshModels()
      } else if (p.status === 'error') {
        setError(p.error ?? 'Download failed')
        setDownloading(null)
        setProgress(null)
        cleanupRef.current?.()
        refreshModels()
      }
    })
  }

  const handleDelete = async (size: ModelSize) => {
    if (size === currentModelSize) {
      // If deleting active model, switch to first remaining downloaded model
      const others = models.filter(m => m.downloaded && m.size !== size)
      if (others.length > 0) onModelChange(others[0].size)
    }
    window.api.deleteModel(size)
    // Wait briefly for FS operation then refresh
    setTimeout(refreshModels, 300)
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <span className="settings-title">Manage Models</span>
        <button className="btn-icon" onClick={onClose} title="Close settings">✕</button>
      </div>

      <div className="model-list-settings">
        {models.map(model => (
          <div key={model.size} className={`model-row ${model.size === currentModelSize ? 'model-row--active' : ''}`}>
            <div className="model-row-info">
              <label className="model-row-label">
                <input
                  type="radio"
                  name="activeModel"
                  value={model.size}
                  checked={model.size === currentModelSize}
                  disabled={!model.downloaded}
                  onChange={() => onModelChange(model.size)}
                />
                <span>{model.label}</span>
              </label>
              {model.downloaded && <span className="model-downloaded-badge">✓</span>}
            </div>

            {downloading === model.size && progress ? (
              <div className="model-row-progress">
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <span className="progress-text">{progress.percent.toFixed(0)}%</span>
              </div>
            ) : (
              <div className="model-row-actions">
                {!model.downloaded ? (
                  <button
                    className="btn-small"
                    onClick={() => handleDownload(model.size)}
                    disabled={downloading !== null}
                  >
                    Download
                  </button>
                ) : (
                  <button
                    className="btn-small btn-small--danger"
                    onClick={() => handleDelete(model.size)}
                    disabled={downloading !== null}
                    title="Delete this model"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="widget-status error">{error}</div>}
    </div>
  )
}
```

- **PATTERN**: Mirror `ModelSetup.tsx` for download flow (same `onDownloadProgress` cleanup pattern)
- **GOTCHA**: Always clean up the `onDownloadProgress` listener in the `useEffect` return AND after each terminal state (complete/error). Use a `ref` to hold the cleanup so it can be called from event handlers.
- **GOTCHA**: `deleteModel` is fire-and-forget — use `setTimeout(refreshModels, 300)` to give the file system time before refreshing the model list.
- **VALIDATE**: `npm run build` — component must compile without TypeScript errors

---

### Task 5: UPDATE `src/renderer/styles.css`

- **ADD** new CSS classes at the bottom of the file for the settings panel:

```css
/* ── Settings Panel ─────────────────────────────────────────── */
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.model-list-settings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.model-row:hover {
  background: var(--bg-secondary);
}

.model-row--active {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.model-row-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.model-row-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}

.model-row-label input[type="radio"] {
  accent-color: var(--accent);
  cursor: pointer;
}

.model-row-label input[type="radio"]:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.model-downloaded-badge {
  font-size: 11px;
  color: var(--accent);
  font-weight: 700;
}

.model-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.model-row-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  width: 100px;
}

.model-row-progress .progress-bar-track {
  flex: 1;
  height: 4px;
}

.progress-text {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 28px;
  text-align: right;
}

.btn-small {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.btn-small:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-small:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-small--danger:hover:not(:disabled) {
  background: var(--accent-danger);
  border-color: var(--accent-danger);
  color: #fff;
}

/* ── Gear icon in titlebar ──────────────────────────────────── */
.titlebar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}
```

- **GOTCHA**: The existing `.progress-bar-track` class is already defined — the `.model-row-progress .progress-bar-track` rule just overrides `height` in that context. No duplication.
- **VALIDATE**: Visually confirm in dev mode that styles apply correctly.

---

### Task 6: UPDATE `src/renderer/App.tsx`

- **ADD** `settingsOpen` state:
  ```typescript
  const [settingsOpen, setSettingsOpen] = useState(false)
  ```
- **ADD** `activeModelSize` state with localStorage persistence:
  ```typescript
  const [activeModelSize, setActiveModelSize] = useState<ModelSize>(
    () => (localStorage.getItem('selectedModelSize') as ModelSize) ?? 'base'
  )
  ```
- **ADD** `handleModelChange` that persists to localStorage:
  ```typescript
  const handleModelChange = (size: ModelSize) => {
    setActiveModelSize(size)
    localStorage.setItem('selectedModelSize', size)
  }
  ```
- **UPDATE** titlebar JSX — add a gear icon button to the right of the theme toggle, before the minimize button. Wrap the right side buttons in `.titlebar-right`:
  ```tsx
  <div className="titlebar-right">
    <button className="btn-icon" onClick={() => setSettingsOpen(s => !s)} title="Settings">⚙</button>
    <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? '☀' : '🌙'}</button>
    <button className="btn-icon" onClick={() => window.api.minimize()}>─</button>
    <button className="btn-icon" onClick={() => window.api.close()}>✕</button>
  </div>
  ```
- **UPDATE** main content render to conditionally show `SettingsPanel`:
  ```tsx
  {appState === 'setup' && <ModelSetup onComplete={() => setAppState('ready')} />}
  {appState === 'ready' && !settingsOpen && (
    <RecordingWidget
      activeModelSize={activeModelSize}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  )}
  {appState === 'ready' && settingsOpen && (
    <SettingsPanel
      currentModelSize={activeModelSize}
      onModelChange={handleModelChange}
      onClose={() => setSettingsOpen(false)}
    />
  )}
  ```
- **IMPORTS**: Add `SettingsPanel` import, `ModelSize` type import
- **PATTERN**: Existing `appState` pattern — see App.tsx lines managing `'loading' | 'setup' | 'ready'`
- **GOTCHA**: `activeModelSize` initialization via lazy initializer `() => ...` prevents reading localStorage on every render.
- **VALIDATE**: `npm run build`

---

### Task 7: UPDATE `src/renderer/components/RecordingWidget.tsx`

- **ADD** new props interface:
  ```typescript
  interface RecordingWidgetProps {
    activeModelSize: ModelSize
    onOpenSettings: () => void
  }
  ```
- **UPDATE** component signature: `export function RecordingWidget({ activeModelSize, onOpenSettings }: RecordingWidgetProps)`
- **UPDATE** `useRecorder` call to pass `activeModelSize` as initial value (see Task 8)
- **ADD** gear icon button in toolbar (optional — App.tsx titlebar gear may be sufficient; skip if redundant):
  - Actually skip the extra gear in toolbar — titlebar gear icon is sufficient. Keep toolbar clean.
- **VALIDATE**: `npm run build`

---

### Task 8: UPDATE `src/renderer/hooks/useRecorder.ts`

- **ADD** `initialModelSize?: ModelSize` parameter to the hook (or accept it as a prop):
  ```typescript
  export function useRecorder(initialModelSize?: ModelSize) {
  ```
- **UPDATE** `selectedModelSize` initial state:
  ```typescript
  const [selectedModelSize, setSelectedModelSize] = useState<ModelSize>(
    initialModelSize ?? (localStorage.getItem('selectedModelSize') as ModelSize) ?? 'base'
  )
  ```
- **UPDATE** `setSelectedModelSize` to also persist to localStorage:
  ```typescript
  const updateModelSize = (size: ModelSize) => {
    setSelectedModelSize(size)
    localStorage.setItem('selectedModelSize', size)
  }
  ```
  Return `updateModelSize` instead of `setSelectedModelSize`.
- **GOTCHA**: The `downloadedModels` state in this hook should refresh whenever `settingsOpen` changes to `false` (i.e. settings panel closed). However, since the hook doesn't know about settings, the simplest approach is: when `RecordingWidget` is mounted (settings panel closed → RecordingWidget shown), `useEffect` on mount already calls `listModels()`. Since RecordingWidget is conditionally rendered (`!settingsOpen`), it unmounts/remounts on each settings close, triggering the refresh automatically.
- **VALIDATE**: `npm run build`

---

### Task 9: UI Polish — Transitions and Loading States

- **UPDATE** `src/renderer/styles.css` — add smooth fade transition for panel switches:
  ```css
  .app-content > * {
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  ```
- **UPDATE** `src/renderer/App.tsx` — while `appState === 'loading'`, show a minimal spinner instead of blank screen:
  ```tsx
  {appState === 'loading' && (
    <div className="loading-spinner">
      <span>Loading…</span>
    </div>
  )}
  ```
- **ADD** to `styles.css`:
  ```css
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary);
    font-size: 13px;
  }
  ```
- **VALIDATE**: `npm run dev` — observe smooth transitions between states

---

### Task 10: Packaging Validation

- **VALIDATE BINARY PATH**: Read `src/main/transcriber.ts` and confirm the packaged binary path logic uses `process.resourcesPath`. It should already be correct per existing code.
- **VALIDATE BUILDER CONFIG**: Read `electron-builder.yml` — confirm `extraResources` includes the whisper binary.
- **RUN**: `npm run build` — confirm TypeScript compiles with zero errors
- **RUN**: `npm run package` — confirm installer builds to `dist-app/`
- **MANUAL**: Install the generated NSIS installer on a Windows machine, download a model, record a phrase, verify transcription works in packaged form.

---

## TESTING STRATEGY

### Unit Tests

No test framework is currently configured. Implement manual validation per task.

### Integration Tests (Manual)

1. **Model Download via Settings**: Open settings panel → click Download on an undownloaded model → verify progress bar updates → verify model row shows ✓ badge and Delete button after completion
2. **Model Delete**: Open settings panel → click Delete on a downloaded model that is NOT the active model → verify it disappears (no ✓ badge) → verify active model unchanged
3. **Delete Active Model**: Open settings panel → click Delete on the ACTIVE model → verify app automatically switches to another downloaded model
4. **Model Switch**: Open settings panel → select a different downloaded model → close settings → record something → verify transcription uses the new model (it will be slower/faster depending on direction)
5. **Hotkey during Settings**: Press `Ctrl+Shift+Space` while settings panel is open → recording should NOT start (RecordingWidget is unmounted)
6. **Theme in Settings**: Toggle theme while settings open → panel should update correctly
7. **Error Recovery**: Simulate download failure (disconnect network mid-download) → verify error message shows → verify Download button re-enables

### Edge Cases

- Only one model downloaded; user tries to delete it → should it be allowed? **Decision**: Allow it, but auto-close settings and show the ModelSetup screen (App.tsx `appState → 'setup'`). **Implementation note**: After a delete in SettingsPanel, if no models remain downloaded, call `onClose()` and App.tsx should re-run the "check if any model downloaded" logic. Add a `onNoModelsLeft` callback or just have App.tsx re-check `listModels()` when settings close.
- Download in progress when user clicks close settings → warn user or prevent close.

---

## VALIDATION COMMANDS

### Level 1: TypeScript Compilation
```bash
npm run build
```
Expected: zero TypeScript errors, zero compilation warnings.

### Level 2: Dev Mode Smoke Test
```bash
npm run dev
```
Expected: App launches, titlebar shows gear icon, clicking gear opens settings panel, all 5 models listed.

### Level 3: Manual Feature Validation
See Integration Tests above.

### Level 4: Packaging
```bash
npm run package
```
Expected: `dist-app/` contains NSIS installer. Install and verify on Windows.

---

## ACCEPTANCE CRITERIA

- [ ] Gear icon visible in titlebar (right side, before minimize)
- [ ] Clicking gear opens Settings Panel, showing all 5 models
- [ ] Downloaded models show ✓ badge and Delete button; undownloaded show Download button
- [ ] Download triggers progress bar inline in the model row
- [ ] Delete removes the model from disk; row reverts to Download button
- [ ] Radio button selects active model; active model persists to localStorage
- [ ] After closing settings, RecordingWidget uses the newly selected model
- [ ] Deleting the only remaining model returns user to ModelSetup screen
- [ ] All transitions are smooth (fadeIn animation)
- [ ] `npm run build` passes with zero errors
- [ ] `npm run package` produces a working installer

---

## COMPLETION CHECKLIST

- [ ] Task 1: `deleteModel()` added to `modelManager.ts`
- [ ] Task 2: `deleteModel` IPC handler added to `ipc.ts`
- [ ] Task 3: `deleteModel` exposed in `preload/index.ts`
- [ ] Task 4: `SettingsPanel.tsx` created and fully implemented
- [ ] Task 5: New CSS classes added to `styles.css`
- [ ] Task 6: `App.tsx` updated with settings state + gear icon
- [ ] Task 7: `RecordingWidget.tsx` updated with new props
- [ ] Task 8: `useRecorder.ts` updated with initialModelSize + localStorage persistence
- [ ] Task 9: Polish (fadeIn animation + loading spinner) added
- [ ] Task 10: `npm run build` and `npm run package` both pass
- [ ] Manual validation of all integration test scenarios

---

## NOTES

### Design Decision: Settings as Full-Panel Overlay (not modal/drawer)

Given the tiny 340x320px window, a modal overlay would feel claustrophobic. Instead, settings **replaces** the recording widget content entirely (conditional render in App.tsx). This is the same pattern used for `ModelSetup` vs `RecordingWidget`. The back/close button is a ✕ in the settings header.

### Design Decision: No "Manage Models" Button in RecordingWidget Toolbar

The titlebar gear icon is the only entry point for settings. Adding it to the toolbar as well would be redundant and clutter the compact UI.

### Design Decision: Auto-Switch on Delete

When the user deletes the currently-active model, the app automatically selects the next available model. This prevents a broken state where the active model no longer exists on disk.

### Design Decision: Unmount RecordingWidget When Settings Open

This is the simplest way to ensure downloaded model list refreshes correctly when settings close — the hook's mount-time `listModels()` call handles it automatically. No need for cross-component state synchronization.

### Edge Case: No models left after delete

If the user deletes all downloaded models, re-run the App.tsx model check and set `appState` back to `'setup'`. This requires the SettingsPanel to call back into App.tsx. Add an `onAllModelsDeleted` prop to SettingsPanel, or have App.tsx poll `listModels()` on settings close.

**Confidence Score: 8.5/10** — All patterns are well-established in the codebase, no new libraries needed, and the IPC surface is already fully understood. The main risk is subtle state management around model deletion triggering a UI state change (settings → setup), which requires a bit of care in the callback chain.
