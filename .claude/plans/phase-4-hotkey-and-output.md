# Feature: Phase 4 — Hotkey & Output

The following plan should be complete, but validate codebase patterns and task sanity before starting.

Pay special attention to naming of existing types, hooks, and IPC channels. Import from the right files — all IPC handlers go in `src/main/ipc.ts`, all contextBridge bindings go in `src/preload/index.ts`.

## Feature Description

Wire up the global hotkey (`Ctrl+Shift+Space`) as a click-to-toggle — same as the Record button. Implement the clipboard copy flow: icon-only clipboard button that copies on click, and an auto-copy toggle that is **ON by default**. The auto-copy label sits right next to the switch, both right-aligned in the actions row. A static hotkey hint is always visible below the actions row.

## User Story

As a user
I want to press `Ctrl+Shift+Space` to toggle recording on/off (same as clicking the Record button), and have transcriptions auto-copied to clipboard by default
So that I can dictate text into any application without touching the app window

## Problem Statement

After Phase 3, the app can record and transcribe but has no global hotkey and no way to copy the result to clipboard. The widget needs hotkey support and clipboard integration.

## Solution Statement

- Rewrite `src/main/hotkey.ts` to use Electron's built-in `globalShortcut` (keydown toggle only — no PTT, no native uiohook-napi needed).
- Add a `copyToClipboard` IPC handler and `set-overlay` overlay handler in `src/main/ipc.ts`.
- Expose `onHotkeyToggle`, `copyToClipboard`, `setOverlay` in the preload contextBridge.
- Update `useRecorder`: keep `toggleRecording` as-is, subscribe to `onHotkeyToggle`, add `autoCopy` state defaulting to `true`.
- Update `RecordingWidget`: Record button stays `onClick={toggleRecording}`; add clipboard icon-only button; add auto-copy toggle (label right next to switch, both right-aligned); show static hotkey hint.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low-Medium
**Primary Systems Affected**: `src/main/hotkey.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/renderer/hooks/useRecorder.ts`, `src/renderer/components/RecordingWidget.tsx`, `src/renderer/styles.css`, `src/main/index.ts`, `package.json`, `electron-builder.yml`
**Dependencies**: None new — uses Electron's built-in `globalShortcut`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/main/hotkey.ts` — Already committed stub using uiohook-napi; **must be rewritten** to use `Electron.globalShortcut` (see task below)
- `src/main/ipc.ts` — Pattern for all IPC handlers; clipboard TODO comments show expected shape
- `src/preload/index.ts` (lines 10–13) — `onThemeChanged` listener pattern to mirror for `onHotkeyToggle`; TODO stubs at lines 29–34
- `src/renderer/hooks/useRecorder.ts` (lines 32–58) — `toggleRecording` stays; add `autoCopy` state and hotkey subscription
- `src/renderer/components/RecordingWidget.tsx` — UI to extend with clipboard button, auto-copy toggle, hotkey hint
- `src/renderer/styles.css` (lines 250–291) — Widget CSS classes to extend

### New Files to Create

None — all changes are to existing files.

### Patterns to Follow

**IPC Channel Names** (from `ipc.ts`):
- `ipcMain.handle` for async request/response: `'listModels'`, `'transcribe'`
- `ipcMain.on` for fire-and-forget: `'minimize'`, `'close'`, `'downloadModel'`
- `win.webContents.send` for push events main → renderer: `'download-progress'`, `'theme-changed'`
- New channel: `'hotkey-toggle'` (push from main), `'copyToClipboard'`, `'set-overlay'` (fire-and-forget from renderer)

**contextBridge listener pattern** (from `preload/index.ts` lines 10–13):
```typescript
onThemeChanged: (cb: (theme: 'dark' | 'light') => void): (() => void) => {
  const handler = (_: Electron.IpcRendererEvent, theme: 'dark' | 'light') => cb(theme)
  ipcRenderer.on('theme-changed', handler)
  return () => { ipcRenderer.removeListener('theme-changed', handler) }
},
```
Mirror this exact pattern for `onHotkeyToggle` (no payload — `cb: () => void`).

**React hook pattern** (from `useRecorder.ts`):
- State with `useState`, refs with `useRef`, memoized callbacks with `useCallback`
- IPC subscriptions in `useEffect` with cleanup function returned

---

## IMPLEMENTATION PLAN

### Phase 1: Main Process — Hotkey, IPC, Preload

Rewrite `hotkey.ts` to use `globalShortcut`. Wire clipboard and overlay into IPC. Expose to renderer via preload.

### Phase 2: Renderer Logic

Add `autoCopy` state (default `true`) and hotkey subscription to `useRecorder`. Keep `toggleRecording` unchanged.

### Phase 3: UI Components & Styles

Update `RecordingWidget` with clipboard button, auto-copy toggle (label right-aligned next to switch), and static hotkey hint.

---

## STEP-BY-STEP TASKS

### RENAME app to "Voice-to-Text-Transcriber"

- **UPDATE** `package.json` — change `"name"` to `"voice-to-text-transcriber"`, add `"productName": "Voice-to-Text-Transcriber"`
- **UPDATE** `electron-builder.yml` — set `productName: Voice-to-Text-Transcriber`
- **UPDATE** `src/renderer/App.tsx` — change titlebar text to `Voice-to-Text-Transcriber`
- **GOTCHA**: `name` in package.json must be lowercase with hyphens. `productName` is the human-readable display name shown in the installer and Start Menu.
- **VALIDATE**: `npm run dev` — titlebar shows "Voice-to-Text-Transcriber"

---

### REWRITE `src/main/hotkey.ts`

The committed stub uses `uiohook-napi` which was designed for PTT (keyup events). Since the hotkey is now toggle-only, replace it entirely with Electron's built-in `globalShortcut`.

- **REMOVE**: All `uiohook-napi` imports and logic
- **IMPLEMENT**:
  ```typescript
  import { globalShortcut } from 'electron'
  import type { BrowserWindow } from 'electron'

  export function registerHotkey(win: BrowserWindow): () => void {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      win.webContents.send('hotkey-toggle')
    })

    return () => {
      globalShortcut.unregister('CommandOrControl+Shift+Space')
    }
  }
  ```
- **GOTCHA**: `globalShortcut` must be called after `app.whenReady()` — it is, because `registerHotkey` is called from inside `app.whenReady()` in `index.ts`.
- **GOTCHA**: `CommandOrControl` in Electron's shortcut string maps to `Ctrl` on Windows.
- **GOTCHA**: `uiohook-napi` is still listed in `package.json` from a previous session. Remove it: `npm uninstall uiohook-napi`. Also remove the `asarUnpack` entry for it from `electron-builder.yml` if present.
- **VALIDATE**: `npm run build` — no TypeScript errors; `npm ls uiohook-napi` — not listed

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
- **GOTCHA**: `win.setOverlayIcon(null, '')` clears the overlay — pass `null` to clear, not the icon
- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/preload/index.ts`

- **ADD** to the `api` object — one hotkey listener, clipboard, and overlay:
  ```typescript
  onHotkeyToggle: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('hotkey-toggle', handler)
    return () => { ipcRenderer.removeListener('hotkey-toggle', handler) }
  },

  copyToClipboard: (text: string): void => ipcRenderer.send('copyToClipboard', text),

  setOverlay: (isRecording: boolean): void => ipcRenderer.send('set-overlay', isRecording),
  ```
- **REMOVE**: The `// TODO Phase 4` comment blocks (lines 29–34)
- **PATTERN**: `src/preload/index.ts:10–13` — `onHotkeyToggle` mirrors `onThemeChanged` exactly (no payload, just `cb: () => void`)
- **VALIDATE**: `npm run build` — `ElectronAPI` type must include the three new members

---

### UPDATE `src/main/index.ts`

- **ADD**: `import { registerHotkey } from './hotkey'`
- **ADD**: Call `registerHotkey(mainWindow)` immediately after `registerIpcHandlers(mainWindow)` inside `app.whenReady()`
- **PATTERN**: Mirror the `registerIpcHandlers` call style
- **VALIDATE**: `npm run dev` — app launches; pressing `Ctrl+Shift+Space` triggers no console errors

---

### UPDATE `src/renderer/hooks/useRecorder.ts`

Keep `toggleRecording` unchanged. Add `autoCopy` (default `true`), auto-copy effect, and hotkey subscription.

- **ADD** state — after the existing state declarations:
  ```typescript
  const [autoCopy, setAutoCopy] = useState(true)
  ```

- **ADD** auto-copy effect — runs when transcript or autoCopy changes:
  ```typescript
  useEffect(() => {
    if (transcript && autoCopy) {
      window.api.copyToClipboard(transcript)
    }
  }, [transcript, autoCopy])
  ```

- **ADD** hotkey subscription effect:
  ```typescript
  useEffect(() => {
    const cleanup = window.api.onHotkeyToggle(() => {
      toggleRecording()
    })
    return cleanup
  }, [toggleRecording])
  ```
  **GOTCHA**: `toggleRecording` is a `useCallback` with `[status, selectedLanguage, selectedModelSize]` deps. The effect re-subscribes when `toggleRecording` changes, which is correct — it ensures the hotkey always calls the latest version of the function.

- **UPDATE** return value — add `autoCopy`/`setAutoCopy`:
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
    toggleRecording,
    autoCopy,
    setAutoCopy,
  }
  ```

- **VALIDATE**: `npm run build` — no TypeScript errors

---

### UPDATE `src/renderer/components/RecordingWidget.tsx`

- **UPDATE** destructuring from `useRecorder()` — add `autoCopy`, `setAutoCopy`:
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
    toggleRecording,
    autoCopy,
    setAutoCopy,
  } = useRecorder()
  ```

- **ADD** `isRecording` derived value and taskbar overlay effect:
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
  **GOTCHA**: Cleanup must call `setOverlay(false)` to clear the overlay if the component unmounts while recording.

- **ADD** copy handler:
  ```typescript
  function handleCopy() {
    if (transcript) window.api.copyToClipboard(transcript)
  }
  ```

- **KEEP** Record button unchanged — click-to-toggle, same as phase 3:
  ```tsx
  <button
    className="btn-primary"
    onClick={toggleRecording}
    disabled={status === 'transcribing'}
    style={isRecording ? { background: 'var(--accent-danger)' } : undefined}
  >
    {status === 'transcribing' ? '⏳ Transcribing...' : isRecording ? '⏹ Stop' : '⏺ Record'}
  </button>
  ```

- **ADD** below the Record button — actions row (clipboard icon + auto-copy) and hotkey hint:
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

    <label className="auto-copy-label">
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

  <p className="hotkey-hint">Press Ctrl+Shift+Space to toggle recording</p>
  ```
  The `.widget-actions` row is `space-between`: clipboard icon anchored left, auto-copy label+switch group anchored right. The label text sits immediately left of the switch with a small gap — no wide space between them.

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

- **ADD** `.widget-actions` — clipboard icon anchored left, auto-copy group anchored right:
  ```css
  .widget-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  ```

- **ADD** `.auto-copy-label` — label text immediately left of the switch, both right-aligned as a unit:
  ```css
  .auto-copy-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    user-select: none;
    cursor: pointer;
  }
  ```

- **ADD** toggle switch CSS:
  ```css
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

- **VALIDATE**: Visual check — clipboard button is 28×28px; "Auto-copy" label and switch are a tight pair on the right; switch is ON by default (accent color); hotkey hint is centered below the actions row

---

### UPDATE `electron-builder.yml`

- **REMOVE**: `asarUnpack` entry for `uiohook-napi` if it exists (no longer needed — `globalShortcut` is built into Electron)
- **VALIDATE**: `npm run build` — no errors

---

## TESTING STRATEGY

### Manual Validation (no automated test infrastructure exists)

**Record button (click-to-toggle):**
1. Click Record → button turns red, status shows recording
2. Click Stop → transcription runs, text appears in textarea
3. Button label: "⏺ Record" → "⏹ Stop" → "⏳ Transcribing..." → "⏺ Record"

**Global hotkey (toggle):**
1. Press `Ctrl+Shift+Space` → recording starts (same as clicking Record)
2. Press `Ctrl+Shift+Space` again → stops and transcribes
3. Hotkey works when app window is **not** focused (minimized or behind other windows)

**Clipboard:**
1. Auto-copy is ON by default (switch shows accent/ON state on first launch)
2. After transcription completes → text is auto-pasted to clipboard (verify by pasting into Notepad)
3. Turn off auto-copy → transcription completes, clipboard is not updated automatically
4. Click clipboard icon button → text copied; hover shows "Copy to clipboard" tooltip
5. Before any transcription → clipboard icon button is disabled (40% opacity)

**Hotkey hint:**
1. Text "Press Ctrl+Shift+Space to toggle recording" is always visible below the actions row

**Layout check:**
1. Clipboard icon button is on the left of the actions row
2. "Auto-copy" label and switch are a tight group on the right — no wide space between the label text and the switch
3. Both light and dark themes: all elements visible and correct colors

**Taskbar overlay:**
1. Start recording → red dot badge appears on the taskbar button
2. Minimize window → red dot still visible
3. Stop recording → red dot clears

**Edge cases:**
- Rapid clicks during transcribing → button disabled, no double-trigger
- Empty transcript → clipboard icon disabled; auto-copy does not fire (guard: `if (transcript && autoCopy)`)
- Hotkey pressed while transcribing → `toggleRecording` is a no-op (status check inside the function)

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
Expected: Electron app launches, no console errors on startup, auto-copy switch is ON by default

### Level 3: Manual Feature Testing
Follow manual validation steps above in the running `npm run dev` session.

### Level 4: Package Check
```bash
npm run package
```
Expected: NSIS installer built to `dist/`. No `uiohook-napi` directory in `dist/win-unpacked/resources/node_modules/`.

---

## ACCEPTANCE CRITERIA

- [ ] Record button is click-to-toggle (`onClick={toggleRecording}`); no mousedown/mouseup handlers
- [ ] `Ctrl+Shift+Space` toggles recording on/off — same behavior as clicking the Record button
- [ ] Hotkey works when the app window is not focused
- [ ] Hotkey hint "Press Ctrl+Shift+Space to toggle recording" is always visible
- [ ] Clipboard icon button (SVG, no text) copies transcript; disabled when empty; tooltip "Copy to clipboard"
- [ ] Auto-copy toggle is **ON by default** on first launch
- [ ] Auto-copy label sits immediately to the left of the switch; both are right-aligned in the actions row
- [ ] Auto-copy: when ON, transcript is auto-written to clipboard after each transcription
- [ ] Auto-copy switch animates (thumb slides, track turns accent color when ON)
- [ ] Red dot overlay appears on taskbar while recording; clears on completion
- [ ] App name shows as "Voice-to-Text-Transcriber" in titlebar
- [ ] `uiohook-napi` is removed from dependencies
- [ ] `npm run build` exits with zero TypeScript errors
- [ ] Both light and dark themes display new UI elements correctly

---

## COMPLETION CHECKLIST

- [ ] `package.json` and `electron-builder.yml` updated with "Voice-to-Text-Transcriber"
- [ ] `src/renderer/App.tsx` titlebar updated
- [ ] `uiohook-napi` uninstalled (`npm uninstall uiohook-napi`); removed from `electron-builder.yml` asarUnpack if present
- [ ] `src/main/hotkey.ts` rewritten to use `globalShortcut`, emitting `'hotkey-toggle'`
- [ ] `src/main/ipc.ts` updated (clipboard + overlay handlers, TODOs removed)
- [ ] `src/preload/index.ts` updated (`onHotkeyToggle`, `copyToClipboard`, `setOverlay`; TODOs removed)
- [ ] `src/main/index.ts` updated (`registerHotkey` called)
- [ ] `src/renderer/hooks/useRecorder.ts` updated — `autoCopy` state (default `true`), auto-copy effect, `onHotkeyToggle` subscription; `toggleRecording` unchanged
- [ ] `src/renderer/components/RecordingWidget.tsx` updated — clipboard icon button, auto-copy label+switch (right-aligned), hotkey hint; Record button unchanged
- [ ] `src/renderer/styles.css` updated — `btn-icon`, `widget-actions`, `auto-copy-label`, `switch`/`switch-slider`, `hotkey-hint`
- [ ] `npm run build` passes with zero errors
- [ ] Manual testing confirms all acceptance criteria

---

## NOTES

### Why globalShortcut instead of uiohook-napi
The original plan used `uiohook-napi` to capture keyup events for push-to-talk (hold-to-record). Since the hotkey is now toggle-only (keydown fires → toggle recording state), Electron's built-in `globalShortcut` is sufficient and far simpler. No native module, no asar unpacking, no binary compatibility concerns.

### Auto-copy default ON
`autoCopy` defaults to `true`. If the user wants this to persist across restarts, save to `localStorage` (same pattern as `theme` in `App.tsx`). Not required but trivial to add.

### Window Height
Phase 4 adds an actions row and a hotkey hint below the Record button. If the layout feels cramped, increase `height` in `src/main/index.ts` `createWindow()` from `280` to `320`.

**Confidence Score: 9/10** — All changes use stable, well-understood Electron and React patterns. No native modules. The main risk is `globalShortcut` conflicting with an existing system shortcut on the user's machine, which would cause silent registration failure — verify by checking `globalShortcut.register` return value and logging in dev.
