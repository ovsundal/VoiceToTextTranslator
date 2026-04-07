# Feature: Phase 4 — Hotkey & Output

The following plan should be complete, but validate codebase patterns and task sanity before starting.

Pay special attention to naming of existing types, hooks, and IPC channels. Import from the right files — all IPC handlers go in `src/main/ipc.ts`, all contextBridge bindings go in `src/preload/index.ts`.

## Feature Description

Wire up the global hotkey (`Ctrl+Shift+Space`) in push-to-talk mode (hold to record, release to transcribe), implement the clipboard copy flow (icon-only button + auto-copy toggle), and surface copy UI in the recording widget. Push-to-talk is always active — there is no mode toggle in the UI. A static hotkey hint tells the user how to record.

## User Story

As a user
I want to hold `Ctrl+Shift+Space` to record and release to transcribe, then click the clipboard icon to copy the result
So that I can dictate text hands-free into any application without a mode picker cluttering the UI

## Problem Statement

After Phase 3, the app can record and transcribe, but there is no way to copy the result, no global hotkey, and the Record button only supports click-to-toggle. The widget needs a clipboard copy button and hotkey support wired up.

## Solution Statement

- Create `src/main/hotkey.ts` using `uiohook-napi` to detect keydown/keyup of `Ctrl+Shift+Space` globally and forward to the renderer via IPC.
- Add a `copyToClipboard` IPC handler and a `set-overlay` overlay handler.
- Expose `onHotkeyPressed`, `onHotkeyReleased`, `copyToClipboard`, `setOverlay` in the preload contextBridge.
- Refactor `useRecorder` to extract `startRecording` / `stopAndTranscribe` helpers, add `autoCopy` state, and subscribe to hotkey IPC. **No `recordingMode` state** — push-to-talk is always the behavior.
- Update `RecordingWidget`: Record button uses `onMouseDown`/`onMouseUp` (PTT always); add clipboard icon-only button; add auto-copy toggle; show static hotkey hint text. **No PTT toggle switch in the UI.**

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: `src/main/hotkey.ts` (new), `src/main/ipc.ts`, `src/preload/index.ts`, `src/renderer/hooks/useRecorder.ts`, `src/renderer/components/RecordingWidget.tsx`, `src/renderer/styles.css`, `src/main/index.ts`, `package.json`, `electron-builder.yml`
**Dependencies**: `uiohook-napi` (new npm dependency — native global key listener for Windows)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/main/ipc.ts` — Pattern for all IPC handlers; clipboard TODO at bottom shows expected shape
- `src/preload/index.ts` (lines 10–13) — `onThemeChanged` listener pattern to mirror for hotkey events; TODO stubs at lines 29–34
- `src/renderer/hooks/useRecorder.ts` (lines 32–58) — `toggleRecording` to refactor into `startRecording` / `stopAndTranscribe`
- `src/renderer/components/RecordingWidget.tsx` — UI to extend with clipboard button, auto-copy toggle, hotkey hint
- `src/renderer/styles.css` (lines 250–291) — Widget CSS classes to extend

### New Files to Create

- `src/main/hotkey.ts` — Global key listener using uiohook-napi; emits `hotkey-pressed` / `hotkey-released` to renderer

### Patterns to Follow

**IPC Channel Names** (from `ipc.ts`):
- `ipcMain.handle` for async request/response: `'listModels'`, `'transcribe'`
- `ipcMain.on` for fire-and-forget: `'minimize'`, `'close'`, `'downloadModel'`
- `win.webContents.send` for push events main → renderer: `'download-progress'`, `'theme-changed'`
- New channels: `'hotkey-pressed'`, `'hotkey-released'` (push from main), `'copyToClipboard'`, `'set-overlay'` (fire-and-forget from renderer)

**contextBridge listener pattern** (from `preload/index.ts` lines 10–13):
```typescript
onThemeChanged: (cb: (theme: 'dark' | 'light') => void): (() => void) => {
  const handler = (_: Electron.IpcRendererEvent, theme: 'dark' | 'light') => cb(theme)
  ipcRenderer.on('theme-changed', handler)
  return () => { ipcRenderer.removeListener('theme-changed', handler) }
},
```
Mirror this exact pattern for `onHotkeyPressed` and `onHotkeyReleased` (no payload — `cb: () => void`).

**React hook pattern** (from `useRecorder.ts`):
- State with `useState`, refs with `useRef`, memoized callbacks with `useCallback`
- IPC subscriptions in `useEffect` with cleanup function returned

---

## IMPLEMENTATION PLAN

### Phase 1: Install Dependency & Create Hotkey Module

Install `uiohook-napi` and create the main-process hotkey module.

### Phase 2: Main Process IPC & Preload

Wire clipboard and hotkey into the IPC layer and expose via contextBridge.

### Phase 3: Renderer Logic

Refactor `useRecorder` to extract `startRecording`/`stopAndTranscribe`, add `autoCopy`, subscribe to hotkey IPC. No `recordingMode` — PTT is always active.

### Phase 4: UI Components & Styles

Update `RecordingWidget` with PTT button handlers, clipboard icon button, auto-copy toggle, and static hotkey hint.

---

## STEP-BY-STEP TASKS

### RENAME app to "Voice-to-Text-Transcriber"

- **UPDATE** `package.json` — change `"name"` to `"voice-to-text-transcriber"`, add `"productName": "Voice-to-Text-Transcriber"`
- **UPDATE** `electron-builder.yml` — set `productName: Voice-to-Text-Transcriber`
- **UPDATE** `src/renderer/App.tsx` — change titlebar text to `Voice-to-Text-Transcriber`
- **GOTCHA**: `name` in package.json must be lowercase with hyphens (npm convention). `productName` is the human-readable display name.
- **VALIDATE**: `npm run dev` — titlebar shows "Voice-to-Text-Transcriber"

---

### INSTALL uiohook-napi

- **IMPLEMENT**: `npm install uiohook-napi` — native Windows key listener that fires both keydown and keyup events globally
- **GOTCHA**: Must be in `dependencies` (not `devDependencies`) so electron-builder includes it.
- **GOTCHA**: In packaged Electron apps, native modules must be unpacked from asar. Add `"asarUnpack": ["**/uiohook-napi/**"]` to `electron-builder.yml`.
- **VALIDATE**: `npm ls uiohook-napi` — shows version without errors

---

### CREATE `src/main/hotkey.ts`

- **IMPLEMENT**: Import `uIOhook` and `UiohookKey` from `uiohook-napi`. On keydown `Ctrl+Shift+Space`, send `'hotkey-pressed'` to renderer. On keyup `Space`, send `'hotkey-released'`. Return a cleanup function that stops uIOhook.
- **PATTERN**: `src/main/ipc.ts` — function takes `win: BrowserWindow` as parameter
- **GOTCHA**: `uIOhook` is a singleton — only call `uIOhook.start()` once using a `started` guard. Return cleanup that calls `uIOhook.stop()`.
- **GOTCHA**: On keyup, check only `e.keycode === UiohookKey.Space` — modifier key states (ctrlKey/shiftKey) are unreliable on keyup. Only check modifiers on keydown.

```typescript
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
```

- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/main/ipc.ts`

- **ADD**: Import `clipboard, nativeImage` from `electron` alongside existing imports
- **ADD**: Create overlay icon at module level:
  ```typescript
  const REC_DOT_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVR42mNgGJTgc/eK/9gw2RqJNogiA4jVjNOQUQOoYMDApwOqJOUBAQAqGoX8qw36TwAAAABJRU5ErkJggg=='
  const recDotIcon = nativeImage.createFromDataURL(`data:image/png;base64,${REC_DOT_B64}`)
  ```
- **ADD** inside `registerIpcHandlers`:
  ```typescript
  ipcMain.on('copyToClipboard', (_, text: string) => { clipboard.writeText(text) })
  ipcMain.on('set-overlay', (_, isRecording: boolean) => {
    win.setOverlayIcon(isRecording ? recDotIcon : null, isRecording ? 'Recording' : '')
  })
  ```
- **REMOVE**: The `// TODO Phase 4` comment blocks
- **GOTCHA**: `win.setOverlayIcon(null, '')` clears the overlay — pass `null` (not the icon) to clear
- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/preload/index.ts`

- **ADD** to the `api` object:
  ```typescript
  onHotkeyPressed: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('hotkey-pressed', handler)
    return () => { ipcRenderer.removeListener('hotkey-pressed', handler) }
  },

  onHotkeyReleased: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('hotkey-released', handler)
    return () => { ipcRenderer.removeListener('hotkey-released', handler) }
  },

  copyToClipboard: (text: string): void => ipcRenderer.send('copyToClipboard', text),

  setOverlay: (isRecording: boolean): void => ipcRenderer.send('set-overlay', isRecording),
  ```
- **REMOVE**: The `// TODO Phase 4` comment blocks (lines 29–34)
- **PATTERN**: `src/preload/index.ts:10–13` — use the `onThemeChanged` pattern for hotkey listeners
- **VALIDATE**: `npm run build` — `ElectronAPI` type must include the four new members

---

### UPDATE `src/main/index.ts`

- **ADD**: `import { registerHotkey } from './hotkey'`
- **ADD**: Call `registerHotkey(mainWindow)` immediately after `registerIpcHandlers(mainWindow)` inside `app.whenReady()`
- **VALIDATE**: `npm run dev` — app launches without errors

---

### REFACTOR `src/renderer/hooks/useRecorder.ts`

Extract `startRecording` / `stopAndTranscribe` from `toggleRecording`. Add `autoCopy`. Subscribe to hotkey IPC. **No `recordingMode` state** — PTT is always the mode.

- **ADD** state:
  ```typescript
  const [autoCopy, setAutoCopy] = useState(false)
  ```

- **REFACTOR**: Extract `startRecording` and `stopAndTranscribe` as `useCallback` functions (content comes from the two branches of the existing `toggleRecording`):
  ```typescript
  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const controls = await recordAudio()
      recorderRef.current = controls
      controls.start()
      setStatus('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      setStatus('error')
    }
  }, [])

  const stopAndTranscribe = useCallback(async () => {
    if (!recorderRef.current) return
    setStatus('transcribing')
    try {
      const wavBuffer = await recorderRef.current.stop()
      recorderRef.current = null
      const text = await window.api.transcribe(wavBuffer, selectedLanguage, selectedModelSize)
      setTranscript(text)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
      setStatus('error')
    }
  }, [selectedLanguage, selectedModelSize])
  ```

- **REMOVE**: `toggleRecording` — no longer needed. PTT is the only mode; the button and hotkey both use `startRecording`/`stopAndTranscribe` directly.

- **ADD**: Auto-copy effect:
  ```typescript
  useEffect(() => {
    if (transcript && autoCopy) {
      window.api.copyToClipboard(transcript)
    }
  }, [transcript, autoCopy])
  ```

- **ADD**: Hotkey subscription effect — PTT always (no mode check):
  ```typescript
  useEffect(() => {
    const cleanupPressed = window.api.onHotkeyPressed(() => {
      startRecording()
    })
    const cleanupReleased = window.api.onHotkeyReleased(() => {
      stopAndTranscribe()
    })
    return () => {
      cleanupPressed()
      cleanupReleased()
    }
  }, [startRecording, stopAndTranscribe])
  ```
  **GOTCHA**: `startRecording` and `stopAndTranscribe` must be stable `useCallback` references for this effect to not re-subscribe every render.

- **UPDATE**: Return value:
  ```typescript
  return {
    status,
    transcript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedModelSize,
    setSelectedModelSize,
    downloadedModels,
    autoCopy,
    setAutoCopy,
    startRecording,
    stopAndTranscribe,
  }
  ```

- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/renderer/components/RecordingWidget.tsx`

- **UPDATE** destructuring from `useRecorder()`:
  ```typescript
  const {
    status,
    transcript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedModelSize,
    setSelectedModelSize,
    downloadedModels,
    autoCopy,
    setAutoCopy,
    startRecording,
    stopAndTranscribe,
  } = useRecorder()
  ```

- **ADD**: `isRecording` derived value and taskbar overlay effect:
  ```typescript
  const isRecording = status === 'recording'

  useEffect(() => {
    document.documentElement.dataset.recording = String(isRecording)
    window.api.setOverlay(isRecording)
    return () => {
      document.documentElement.dataset.recording = 'false'
      window.api.setOverlay(false)
    }
  }, [isRecording])
  ```

- **ADD**: Copy handler:
  ```typescript
  function handleCopy() {
    if (transcript) window.api.copyToClipboard(transcript)
  }
  ```

- **UPDATE**: Record button — always PTT (mousedown/mouseup), no click handler:
  ```tsx
  <button
    className={`btn-primary${isRecording ? ' recording' : ''}`}
    onMouseDown={startRecording}
    onMouseUp={stopAndTranscribe}
    onMouseLeave={isRecording ? stopAndTranscribe : undefined}
    disabled={status === 'transcribing'}
    style={isRecording ? { background: 'var(--accent-danger)', userSelect: 'none' } : { userSelect: 'none' }}
  >
    {status === 'transcribing' ? '⏳ Transcribing...' : isRecording ? '⏹ Release to stop' : '⏺ Hold to record'}
  </button>
  ```

- **ADD**: Below the Record button — clipboard icon button, auto-copy toggle row, and static hotkey hint:
  ```tsx
  <div className="widget-actions">
    <button
      className="btn-icon"
      onClick={handleCopy}
      disabled={!transcript}
      title="Copy to clipboard"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>

    <label className="switch-row">
      <span>Auto-copy</span>
      <label className="switch">
        <input
          type="checkbox"
          checked={autoCopy}
          onChange={(e) => setAutoCopy(e.target.checked)}
        />
        <span className="switch-slider" />
      </label>
    </label>
  </div>

  <p className="hotkey-hint">Hold Ctrl+Shift+Space to record</p>
  ```

- **REMOVE**: Any leftover `toggleRecording` references or `recordingMode` / `setRecordingMode` usage
- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/renderer/styles.css`

- **ADD** `.btn-icon` — compact icon-only button:
  ```css
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-secondary);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 100ms ease-out;
    flex-shrink: 0;
  }

  .btn-icon:hover {
    background: var(--border);
  }

  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  ```

- **ADD** `.widget-actions` — row containing the clipboard button and auto-copy toggle:
  ```css
  .widget-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .widget-actions .switch-row {
    flex: 1;
  }
  ```

- **ADD** toggle switch CSS (shared, used by auto-copy):
  ```css
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-secondary);
    user-select: none;
    cursor: pointer;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--border);
    border-radius: 18px;
    transition: background-color 150ms ease-out;
  }

  .switch-slider::before {
    content: '';
    position: absolute;
    height: 12px;
    width: 12px;
    left: 3px;
    bottom: 3px;
    background: #ffffff;
    border-radius: 50%;
    transition: transform 150ms ease-out;
  }

  .switch input:checked + .switch-slider {
    background: var(--accent);
  }

  .switch input:checked + .switch-slider::before {
    transform: translateX(14px);
  }
  ```

- **ADD** hotkey hint:
  ```css
  .hotkey-hint {
    font-size: 11px;
    color: var(--text-secondary);
    margin: 0;
    opacity: 0.7;
    text-align: center;
  }
  ```

- **VALIDATE**: Visual check — clipboard icon button is 28×28px square; auto-copy switch animates; hotkey hint is visible in both themes

---

### UPDATE `electron-builder.yml`

- **ADD**:
  ```yaml
  asarUnpack:
    - "node_modules/uiohook-napi/**"
  ```
- **GOTCHA**: Without this, the packaged app cannot load the native `.node` file from inside the asar archive.
- **VALIDATE**: `npm run package` — check that `node_modules/uiohook-napi` appears unpacked in `dist/win-unpacked/resources/`

---

## TESTING STRATEGY

### Manual Validation (no automated test infrastructure exists)

**Default behavior (PTT always active):**
1. Launch app — no PTT toggle switch visible anywhere in the UI
2. Hold the Record button → status shows recording (red), label shows "Release to stop"
3. Release the Record button → transcribes; text appears in textarea
4. Hold `Ctrl+Shift+Space` → recording starts; release → transcribes
5. Hotkey works when the app window is **not** focused (global shortcut)

**Clipboard:**
1. After transcription, clipboard icon button is enabled; click it → text is in clipboard (paste to notepad to verify)
2. Before transcription (empty textarea) → clipboard button is disabled (grayed out, 40% opacity)
3. Hover clipboard button → tooltip reads "Copy to clipboard"
4. Enable "Auto-copy" switch → after next transcription, text auto-pastes without clicking the icon button

**Hotkey hint:**
1. Static text "Hold Ctrl+Shift+Space to record" is always visible below the actions row

**Taskbar overlay:**
1. Start recording → red dot badge appears on the taskbar button
2. Minimize the window → red dot badge still visible
3. Stop → red dot clears

**Edge cases:**
- Rapid mousedown/mouseup: only one recording session triggered
- Mouse leaves button while recording → recording stops (onMouseLeave guard)
- No transcript: clipboard icon disabled

---

## VALIDATION COMMANDS

### Level 1: TypeScript Compilation
```bash
npm run build
```
Expected: exits 0, no errors in any modified file

### Level 2: Dev Run
```bash
npm run dev
```
Expected: Electron app launches, no console errors on startup

### Level 3: Manual Feature Testing
Follow manual validation steps above in the running `npm run dev` session.

### Level 4: Package Check
```bash
npm run package
```
Expected: NSIS installer built to `dist/`; `dist/win-unpacked/resources/` contains unpacked `node_modules/uiohook-napi/`

---

## ACCEPTANCE CRITERIA

- [ ] No push-to-talk toggle switch exists in the UI
- [ ] Record button uses `onMouseDown`/`onMouseUp` (hold-to-record always); label reads "Hold to record" / "Release to stop"
- [ ] `Ctrl+Shift+Space` hold starts recording; release stops and transcribes (works when app is not focused)
- [ ] Hotkey hint "Hold Ctrl+Shift+Space to record" is always visible below the actions row
- [ ] Clipboard icon button (SVG, no text) copies transcript to clipboard; disabled when transcript is empty; tooltip reads "Copy to clipboard"
- [ ] "Auto-copy" toggle switch: when ON, transcript is auto-written to clipboard on completion
- [ ] Auto-copy switch animates correctly (thumb slides, track turns accent color when ON)
- [ ] Red dot overlay appears on taskbar while recording; clears on completion
- [ ] Red dot visible when window is minimized during recording
- [ ] App name shows as "Voice-to-Text-Transcriber" in titlebar, installer, and Start Menu
- [ ] `npm run build` exits with zero TypeScript errors
- [ ] Both light and dark themes display new UI elements correctly

---

## COMPLETION CHECKLIST

- [ ] `package.json` and `electron-builder.yml` updated with "Voice-to-Text-Transcriber"
- [ ] `src/renderer/App.tsx` titlebar updated
- [ ] `uiohook-napi` installed in `dependencies`
- [ ] `electron-builder.yml` has `asarUnpack` for uiohook-napi
- [ ] `src/main/hotkey.ts` created
- [ ] `src/main/ipc.ts` updated (clipboard + overlay handlers, TODOs removed)
- [ ] `src/preload/index.ts` updated (4 new API members; TODOs removed)
- [ ] `src/main/index.ts` updated (`registerHotkey` called)
- [ ] `src/renderer/hooks/useRecorder.ts` refactored — `startRecording`/`stopAndTranscribe` extracted, `autoCopy` added, hotkey subscribed, `toggleRecording`/`recordingMode` removed
- [ ] `src/renderer/components/RecordingWidget.tsx` updated — PTT button handlers, clipboard icon button, auto-copy toggle, static hotkey hint; no PTT switch
- [ ] `src/renderer/styles.css` updated — `btn-icon`, `widget-actions`, `switch-row`/`switch`/`switch-slider`, `hotkey-hint`
- [ ] `npm run build` passes with zero errors
- [ ] Manual testing confirms all acceptance criteria

---

## NOTES

### Why uiohook-napi instead of Electron globalShortcut
Electron's `globalShortcut` only fires on keydown — it has no keyup event. True push-to-talk (hold-to-record) via a global hotkey requires a native key hook. `uiohook-napi` ships prebuilt Windows binaries and is the standard solution for this in Electron apps.

### No recordingMode state
The previous plan had a UI toggle between "push-to-talk" and "toggle" modes. The user has simplified this: **PTT is always active**. There is no `recordingMode` state, no `setRecordingMode`, and no mode selector in the UI. Both the Record button and the global hotkey always use `startRecording` on press and `stopAndTranscribe` on release.

### Window Height
Phase 4 adds an actions row (clipboard + auto-copy) and a hotkey hint below the Record button. If the layout feels cramped, increase `height` in `src/main/index.ts` `createWindow()` from `280` to `320`.

### Persisting autoCopy preference
`autoCopy` is in-memory only. To persist across restarts, save to `localStorage` (same pattern as `theme` in `App.tsx`). Not required by the PRD but trivial to add.

**Confidence Score: 9/10** — Scope is well-defined. The only risk is `uiohook-napi` native module loading in the packaged build; if it fails, the hotkey silently doesn't work but the rest of the app is unaffected.
