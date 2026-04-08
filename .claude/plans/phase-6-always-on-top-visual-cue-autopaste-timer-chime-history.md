# Feature: Phase 6 — Always-on-Top, Visual Cue, Auto-Paste, Timer, Chime, History

The following plan is complete, but validate codebase patterns and import paths before implementing each task.

Pay special attention to the existing IPC pattern (ipcMain.on vs ipcMain.handle), the preload `api` object shape, and the `useRecorder` hook's internal state management.

## Feature Description

Six cohesive UX improvements to the VoiceToText Translator:

1. **Always-on-top while recording** — the floating widget rises above all other windows the moment recording starts, and sinks back when done.
2. **Visual recording indicator** — pulsing glow on the Record button + blinking red dot in the titlebar, both driven by the existing `data-recording` attribute on `<html>`.
3. **Auto-paste toggle** — a sibling to auto-copy; after transcription, simulates Ctrl+V into whichever window has focus (works cleanly with the global hotkey flow).
4. **Recording duration timer** — live `MM:SS` counter displayed inside the Stop button label while recording.
5. **Start/stop audio chime** — short programmatically-generated tones (rising on start, falling on stop) via the Web Audio API; no asset files needed.
6. **Session transcript history** — in-memory ring buffer (max 10) of past transcriptions with ‹ / › navigation arrows shown above the transcript area.

## User Story

As a user of VoiceToText Translator  
I want better feedback while recording and quick access to past transcriptions  
So that I feel confident the app is working and can recover text I've already dictated

## Problem Statement

Currently: no confirmation the widget is visible above other windows; no live feedback during recording beyond button color; no way to paste without touching the mouse; no way to review a previous transcription.

## Solution Statement

Minimal, focused additions — two new IPC channels, one new renderer utility file, extensions to `useRecorder`, and CSS-only visual changes. No new npm dependencies required.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: Main process (IPC), Preload bridge, `useRecorder` hook, `RecordingWidget` component, CSS  
**Dependencies**: None new — uses `child_process` (already in Node), Web Audio API (already in Chromium), `ipcMain`/`ipcRenderer` (existing)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/main/ipc.ts` (lines 1–42) — all existing IPC handlers; add two new ones here (`set-always-on-top`, `auto-paste`). Note: clipboard uses `ipcMain.on`; transcription uses `ipcMain.handle`. Use `.on` for fire-and-forget (always-on-top), `.handle` for async reply (auto-paste).
- `src/preload/index.ts` (lines 1–46) — the `api` object whose type is auto-exported as `ElectronAPI`. Every new main-process channel needs a matching entry here. Pattern: `.send()` for `.on` handlers, `.invoke()` for `.handle` handlers.
- `src/renderer/hooks/useRecorder.ts` (lines 1–96) — hook owns all recording state. Timer, chime calls, autoPaste state, and history ring buffer all live here. `toggleRecording` (lines 42–68) is where recording starts/stops — that's where timer start/stop and chime calls go. Auto-paste mirrors the auto-copy `useEffect` pattern (lines 71–74).
- `src/renderer/components/RecordingWidget.tsx` (lines 27–34) — existing `useEffect` that calls `window.api.setOverlay(isRecording)`; add `window.api.setAlwaysOnTop(isRecording)` here. History nav UI and timer display also go in this component.
- `src/renderer/styles.css` (lines 1–557) — CSS variable system, `data-theme` + `data-recording` attributes on `<html>`. Recording pulse goes under `/* Recording Widget */` section. History nav styles go at end of file. Use existing variables: `--accent-danger`, `--border`, `--text-secondary`, `--bg-secondary`.
- `src/types/electron.d.ts` — imports `ElectronAPI` from preload and declares `window.api`. No changes needed if preload export is updated correctly.

### New Files to Create

- `src/renderer/chime.ts` — standalone `playChime(type: 'start' | 'stop'): void` using Web Audio API. No React, no imports from rest of project.

### Relevant Documentation

- [Electron BrowserWindow.setAlwaysOnTop](https://www.electronjs.org/docs/latest/api/browser-window#winsetalwaysontoplevel-relativewindow)
  - Use `win.setAlwaysOnTop(true, 'screen-saver')` on Windows to float above taskbars — or plain `true` which is sufficient.
- [Web Audio API — AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
  - `OscillatorNode` + `GainNode` pattern for programmatic tones; call `ctx.close()` in `osc.onended` to avoid AudioContext leak.
- [Windows PowerShell WScript.Shell SendKeys](https://learn.microsoft.com/en-us/office/vba/language/reference/user-interface-help/sendkeys-statement)
  - `^v` = Ctrl+V. Use `-WindowStyle Hidden` and `-NonInteractive` to suppress console flash.

### Patterns to Follow

**IPC fire-and-forget (no return value):**
```typescript
// ipc.ts
ipcMain.on('minimize', () => win.minimize())

// preload/index.ts
minimize: () => ipcRenderer.send('minimize'),
```

**IPC async with return value:**
```typescript
// ipc.ts
ipcMain.handle('transcribe', async (_, ...) => { return result })

// preload/index.ts
transcribe: (...): Promise<string> => ipcRenderer.invoke('transcribe', ...)
```

**State persisted to localStorage (existing autoCopy pattern to mirror for autoPaste):**
```typescript
const [autoCopy, setAutoCopy] = useState(true)  // useRecorder.ts line 21
// autoPaste should default to false (opt-in, more surprising behavior)
const [autoPaste, setAutoPaste] = useState(() => localStorage.getItem('autoPaste') === 'true')
// persist on change via useEffect
```

**Reacting to transcript change (mirror for autoPaste):**
```typescript
// useRecorder.ts lines 71-74
useEffect(() => {
  if (transcript && autoCopy) {
    window.api.copyToClipboard(transcript)
  }
}, [transcript, autoCopy])
```

**Setting data attribute on html root (existing pattern):**
```typescript
// RecordingWidget.tsx line 29
document.documentElement.dataset.recording = String(isRecording)
```

**CSS targeting data attribute on html root:**
```css
/* styles.css line 5 */
:root[data-theme="dark"] { ... }
/* same pattern for recording: */
:root[data-recording="true"] .btn-primary { ... }
```

---

## IMPLEMENTATION PLAN

### Phase 1: Main process — two new IPC channels

Add `set-always-on-top` (fire-and-forget) and `auto-paste` (async) to `ipc.ts`. Import `exec` from `child_process`.

### Phase 2: Preload bridge

Expose `setAlwaysOnTop` and `autoPaste` on the `api` object so `window.api` types automatically update everywhere.

### Phase 3: Chime utility

Create `src/renderer/chime.ts` — pure Web Audio API, no dependencies, safe to call from any renderer context.

### Phase 4: useRecorder hook extensions

Add to `useRecorder`:
- `autoPaste` state (localStorage-backed, default `false`)
- `recordingSeconds` + `timerRef` for the live counter
- Chime calls in `toggleRecording` at start and stop
- History ring buffer (`history: string[]`, `historyIdx: number`)
- Auto-paste side-effect (mirrors auto-copy useEffect)
- Return new values: `autoPaste`, `setAutoPaste`, `recordingSeconds`, `history`, `historyIdx`, `goBack`, `goFwd`

### Phase 5: RecordingWidget UI updates

- Add `setAlwaysOnTop` call alongside existing `setOverlay` in the `isRecording` useEffect
- Show `formatDuration(recordingSeconds)` inside the Stop button label
- Add history navigation row above textarea (hidden when `history.length === 0`)
- Add Auto-paste toggle to widget actions row

### Phase 6: CSS additions

- `@keyframes recordingPulse` + apply to `:root[data-recording="true"] .btn-primary`
- Blinking dot via `:root[data-recording="true"] .titlebar-title::after`
- `.history-nav` styles
- `.history-counter` style

---

## STEP-BY-STEP TASKS

### UPDATE `src/main/ipc.ts`

- **ADD** import: `import { exec } from 'child_process'` at top of file
- **ADD** `set-always-on-top` handler after the existing `ipcMain.on('close', ...)` handler:
  ```typescript
  ipcMain.on('set-always-on-top', (_, on: boolean) => {
    win.setAlwaysOnTop(on)
  })
  ```
- **ADD** `auto-paste` handler after the `copyToClipboard` handler:
  ```typescript
  ipcMain.handle('auto-paste', () => {
    return new Promise<void>((resolve, reject) => {
      exec(
        'powershell -WindowStyle Hidden -NonInteractive -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys(\'^v\')"',
        (err) => { if (err) reject(err); else resolve() }
      )
    })
  })
  ```
- **PATTERN**: `ipcMain.on` for set-always-on-top (no return needed), `ipcMain.handle` for auto-paste (caller awaits confirmation)
- **GOTCHA**: PowerShell `^` inside a double-quoted `-Command` string needs escaping as `\'^v\'` (single-quoted inside PS) — the command above is correct
- **VALIDATE**: `npm run build` — TypeScript must compile with no errors

### UPDATE `src/preload/index.ts`

- **ADD** two entries to the `api` object, after `copyToClipboard`:
  ```typescript
  setAlwaysOnTop: (on: boolean): void => ipcRenderer.send('set-always-on-top', on),
  autoPaste: (): Promise<void> => ipcRenderer.invoke('auto-paste'),
  ```
- **PATTERN**: mirrors `copyToClipboard` (send) and `transcribe` (invoke) respectively
- **GOTCHA**: The `ElectronAPI` type is auto-derived from this object — no manual type edits needed. `src/types/electron.d.ts` imports it directly.
- **VALIDATE**: `npm run build` — `window.api.setAlwaysOnTop` and `window.api.autoPaste` must be type-safe

### CREATE `src/renderer/chime.ts`

- **IMPLEMENT** a single exported function:
  ```typescript
  export function playChime(type: 'start' | 'stop'): void {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'start') {
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.linearRampToValueAtTime(880, now + 0.12)
    } else {
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.linearRampToValueAtTime(440, now + 0.18)
    }

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc.start(now)
    osc.stop(now + 0.25)
    osc.onended = () => ctx.close()
  }
  ```
- **GOTCHA**: Each call creates and immediately closes its own `AudioContext` — no persistent instance, no leak. `exponentialRampToValueAtTime` requires the start value to be > 0, so `0.18` is correct (not 0).
- **VALIDATE**: `npm run build` — file must compile clean

### UPDATE `src/renderer/hooks/useRecorder.ts`

- **ADD** import at top: `import { playChime } from '../chime'`
- **ADD** state + ref declarations (after existing `autoCopy` state on line 21):
  ```typescript
  const [autoPaste, setAutoPasteState] = useState(() => localStorage.getItem('autoPaste') === 'true')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // History ring buffer
  const MAX_HISTORY = 10
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(0)
  ```
- **ADD** `setAutoPaste` wrapper (persist to localStorage):
  ```typescript
  const setAutoPaste = useCallback((val: boolean) => {
    setAutoPasteState(val)
    localStorage.setItem('autoPaste', String(val))
  }, [])
  ```
- **UPDATE** `toggleRecording` — add timer + chime at start and stop points:

  _Start path_ (after `controls.start()`, before `setStatus('recording')`):
  ```typescript
  playChime('start')
  setRecordingSeconds(0)
  timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
  ```

  _Stop path_ (after `setStatus('transcribing')`, before `recorderRef.current.stop()`):
  ```typescript
  if (timerRef.current) {
    clearInterval(timerRef.current)
    timerRef.current = null
  }
  playChime('stop')
  ```

  _After `setTranscript(text)` call_ — update history:
  ```typescript
  setHistory(prev => {
    const next = [...prev, text]
    return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
  })
  setHistoryIdx(-1) // -1 signals "latest" — resolved in derived value below
  ```

  _Error paths_ — clear timer on error as well (inside the catch block, before `setStatus('error')`):
  ```typescript
  if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  ```

- **ADD** auto-paste side-effect (after existing auto-copy useEffect):
  ```typescript
  useEffect(() => {
    if (history.length > 0 && autoPaste) {
      window.api.autoPaste().catch(console.error)
    }
  }, [history, autoPaste])
  ```
  - **GOTCHA**: Trigger on `history` change rather than `transcript` so it fires AFTER clipboard write (auto-copy runs on `transcript`). Order of effects is deterministic in React (same render cycle), but this sequencing makes intent clear.

- **ADD** history navigation helpers (after the `updateModelSize` callback):
  ```typescript
  // Resolve the actual index when historyIdx is -1 (latest)
  const resolvedIdx = historyIdx === -1 ? history.length - 1 : historyIdx
  const displayedTranscript = history[resolvedIdx] ?? ''

  const canGoBack = resolvedIdx > 0
  const canGoFwd = resolvedIdx < history.length - 1

  const goBack = useCallback(() => {
    setHistoryIdx(prev => {
      const cur = prev === -1 ? history.length - 1 : prev
      return Math.max(0, cur - 1)
    })
  }, [history.length])

  const goFwd = useCallback(() => {
    setHistoryIdx(prev => {
      const cur = prev === -1 ? history.length - 1 : prev
      const next = cur + 1
      return next >= history.length ? -1 : next
    })
  }, [history.length])
  ```

- **UPDATE** return object — add new values:
  ```typescript
  return {
    // existing...
    status, transcript, error,
    selectedLanguage, setSelectedLanguage,
    selectedModelSize, updateModelSize,
    downloadedModels, toggleRecording,
    autoCopy, setAutoCopy,
    // new:
    autoPaste, setAutoPaste,
    recordingSeconds,
    history,
    displayedTranscript,
    canGoBack, canGoFwd, goBack, goFwd,
  }
  ```

- **GOTCHA**: Keep the existing `transcript` in the return for the auto-copy `useEffect` — it's still needed. `displayedTranscript` is a separate derived value for display.
- **VALIDATE**: `npm run build` — no TypeScript errors in hook

### UPDATE `src/renderer/components/RecordingWidget.tsx`

- **ADD** destructured values from `useRecorder`:
  ```typescript
  const {
    status, transcript, error,
    selectedLanguage, setSelectedLanguage,
    selectedModelSize, updateModelSize,
    downloadedModels, toggleRecording,
    autoCopy, setAutoCopy,
    // new:
    autoPaste, setAutoPaste,
    recordingSeconds,
    history, displayedTranscript,
    canGoBack, canGoFwd, goBack, goFwd,
  } = useRecorder(activeModelSize)
  ```

- **UPDATE** existing `isRecording` useEffect (lines 27–34) — add `setAlwaysOnTop`:
  ```typescript
  useEffect(() => {
    document.documentElement.dataset.recording = String(isRecording)
    window.api.setOverlay(isRecording)
    window.api.setAlwaysOnTop(isRecording)
    return () => {
      document.documentElement.dataset.recording = 'false'
      window.api.setOverlay(false)
      window.api.setAlwaysOnTop(false)
    }
  }, [isRecording])
  ```

- **ADD** `formatDuration` helper (outside component, below imports):
  ```typescript
  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }
  ```

- **UPDATE** Record button label to include timer:
  ```tsx
  {status === 'transcribing'
    ? '⏳ Transcribing...'
    : isRecording
      ? `⏹ Stop  ${formatDuration(recordingSeconds)}`
      : '⏺ Record'}
  ```

- **UPDATE** `<textarea>` to use `displayedTranscript` instead of `transcript`:
  ```tsx
  <textarea
    className="widget-transcript"
    readOnly
    value={displayedTranscript}
    placeholder="Transcription will appear here..."
  />
  ```

- **ADD** history navigation row — insert between the toolbar and the textarea:
  ```tsx
  {history.length > 0 && (
    <div className="history-nav">
      <button
        className="btn-icon"
        onClick={goBack}
        disabled={!canGoBack}
        title="Previous transcription"
      >‹</button>
      <span className="history-counter">
        {(canGoBack || canGoFwd)
          ? `${history.indexOf(displayedTranscript) + 1} / ${history.length}`
          : `1 / 1`}
      </span>
      <button
        className="btn-icon"
        onClick={goFwd}
        disabled={!canGoFwd}
        title="Next transcription"
      >›</button>
    </div>
  )}
  ```
  - **GOTCHA**: `history.indexOf(displayedTranscript)` works since strings are primitives; if two entries are identical it'll show the first match. Acceptable edge case.

- **ADD** auto-paste toggle to the `widget-actions` row — after the existing auto-copy label:
  ```tsx
  <label className="auto-copy-label">
    <span>Auto-paste</span>
    <label className="switch">
      <input
        type="checkbox"
        checked={autoPaste}
        onChange={(e) => setAutoPaste(e.target.checked)}
      />
      <span className="switch-slider" />
    </label>
  </label>
  ```
  - **PATTERN**: identical markup to the auto-copy toggle already in place (lines 92–101 of RecordingWidget). Reuse `.auto-copy-label` and `.switch` classes.
  - **LAYOUT NOTE**: The actions row currently has copy icon on left, auto-copy on right. Adding auto-paste creates three items. Switch to `gap: 8px` flex row — both toggles side by side on the right, copy icon on the left. Update the `justify-content` of `.widget-actions` from `space-between` to keep icon left and group the two toggles right:
    ```tsx
    <div className="widget-actions">
      <button className="btn-icon" onClick={handleCopy} ...>...</button>
      <div className="widget-toggles">
        {/* auto-copy label */}
        {/* auto-paste label */}
      </div>
    </div>
    ```

- **VALIDATE**: `npm run build` — component compiles; no prop type errors

### UPDATE `src/renderer/styles.css`

- **ADD** recording pulse + titlebar dot (append after the `/* Recording Widget */` section, around line 295):
  ```css
  /* ── Recording visual indicators ───────────────────────────── */
  @keyframes recordingPulse {
    0%   { box-shadow: 0 0 0 0   rgba(243, 139, 168, 0.7); }
    70%  { box-shadow: 0 0 0 9px rgba(243, 139, 168, 0);   }
    100% { box-shadow: 0 0 0 0   rgba(243, 139, 168, 0);   }
  }

  :root[data-recording="true"] .btn-primary {
    animation: recordingPulse 1.4s ease-out infinite;
  }

  @keyframes recordingBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }

  :root[data-recording="true"] .titlebar-title::after {
    content: ' ⏺';
    color: var(--accent-danger);
    font-size: 9px;
    animation: recordingBlink 1s step-start infinite;
    vertical-align: middle;
  }
  ```

- **ADD** history nav + widget-toggles styles (append at end of file):
  ```css
  /* ── History navigation ─────────────────────────────────────── */
  .history-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
    margin-bottom: 2px;
  }

  .history-counter {
    font-size: 11px;
    color: var(--text-secondary);
    min-width: 36px;
    text-align: center;
    user-select: none;
  }

  /* ── Widget action row with two toggles ─────────────────────── */
  .widget-toggles {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  ```

- **VALIDATE**: App renders correctly; no CSS parse errors in DevTools

---

## TESTING STRATEGY

This project has no automated test suite. Validation is manual + build-time TypeScript checks.

### Build Validation
`npm run build` must pass with zero TypeScript errors after each task.

### Manual Validation Checklist

**Always-on-top:**
- [ ] Start recording → widget floats above other windows (open Notepad behind it to verify)
- [ ] Stop recording → widget no longer forces itself above Notepad

**Visual indicator:**
- [ ] Record button pulses with a red glow ring while recording
- [ ] Titlebar title shows a blinking ⏺ dot while recording
- [ ] Both stop immediately when recording ends

**Timer:**
- [ ] Counter starts at `00:00` when recording begins
- [ ] Increments every second: `00:01`, `00:02`, etc.
- [ ] Displayed inside the Stop button: `⏹ Stop  00:07`
- [ ] Resets to zero on next recording

**Chime:**
- [ ] Rising tone plays at recording start
- [ ] Falling tone plays at recording stop
- [ ] No audio context leak warnings in DevTools Console after multiple recordings

**Auto-paste:**
- [ ] Toggle is off by default; state persists across restarts (localStorage)
- [ ] When ON + global hotkey used: transcription is pasted into the previously focused app
- [ ] When ON + button used: Ctrl+V fires (may paste into app itself — acceptable known limitation)
- [ ] Toggle label reads "Auto-paste"
- [ ] Enabling auto-paste while auto-copy is off still works (clipboard is written by auto-paste flow via the existing `copyToClipboard` call + then `autoPaste` IPC)

**History:**
- [ ] First transcription: no nav arrows shown (history.length === 0 before first)
- [ ] Second transcription: `‹` and `›` arrows appear; counter shows `2 / 2`
- [ ] `‹` navigates to previous entry; counter shows `1 / 2`
- [ ] `›` navigates forward; counter shows `2 / 2`
- [ ] `‹` is disabled when at oldest entry; `›` is disabled when at newest
- [ ] New transcription while viewing old entry → auto-jumps to latest
- [ ] After 11 transcriptions: history stays at 10 entries max (oldest dropped)

---

## VALIDATION COMMANDS

### Level 1: TypeScript compilation
```bash
npm run build
```
Expected: exit code 0, no errors.

### Level 2: Dev run (smoke test)
```bash
npm run dev
```
Expected: app launches, all UI elements render, no console errors on load.

### Level 3: Manual feature tests
Follow the Manual Validation Checklist above.

---

## ACCEPTANCE CRITERIA

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Window floats above all other windows during recording, returns to normal when stopped
- [ ] Record button displays a pulsing glow ring while recording
- [ ] Titlebar shows a blinking red dot while recording
- [ ] Live `MM:SS` timer is visible inside the Stop button label
- [ ] Rising chime plays on recording start; falling chime plays on stop
- [ ] No AudioContext leaks after multiple recordings (no "AudioContext was not allowed to start" warnings)
- [ ] Auto-paste toggle added to actions row; defaults to OFF; persists to localStorage
- [ ] Ctrl+V is simulated after transcription when auto-paste is ON
- [ ] History ring buffer stores up to 10 entries
- [ ] `‹` / `›` navigation between entries works; counter reflects position
- [ ] New transcription auto-jumps view to latest entry
- [ ] All existing functionality unchanged (auto-copy, model switching, hotkey, settings panel)

---

## COMPLETION CHECKLIST

- [ ] `src/main/ipc.ts` — two new handlers added
- [ ] `src/preload/index.ts` — two new API entries added
- [ ] `src/renderer/chime.ts` — created
- [ ] `src/renderer/hooks/useRecorder.ts` — timer, chime, autoPaste, history added; new values returned
- [ ] `src/renderer/components/RecordingWidget.tsx` — setAlwaysOnTop, timer label, history nav, auto-paste toggle added
- [ ] `src/renderer/styles.css` — pulse animation, blinking dot, history nav, widget-toggles styles added
- [ ] `npm run build` passes
- [ ] Manual validation checklist completed

---

## NOTES

### Auto-paste timing caveat
Auto-paste works cleanly when recording is controlled via the global hotkey (`Ctrl+Shift+Space`). In that flow the target application retains focus throughout, so the simulated Ctrl+V lands in the correct window. When recording is started/stopped via the in-app button, the VoiceToText window has focus and Ctrl+V pastes there instead. This is a known, acceptable limitation of the PowerShell `SendKeys` approach and requires no special handling — the user can switch windows in the ~1–2s transcription window if needed.

### Auto-paste + auto-copy interaction
Auto-paste depends on auto-copy having already written the clipboard (or on the text being in the clipboard from a previous step). The two side effects fire in the same React render cycle: auto-copy effect runs first (watching `transcript`), auto-paste effect runs second (watching `history`). History is updated in `toggleRecording` *after* `setTranscript`, so the sequencing is: transcript updates → auto-copy fires → history updates → auto-paste fires. This ordering is correct.

### AudioContext autoplay policy
Modern Chromium requires a user gesture before creating an AudioContext. Recording is always user-initiated (button click or global hotkey), so the chime is created in direct response to a user gesture. No autoplay issues expected.

### History index management
Using `-1` as a sentinel for "latest" avoids a stale closure problem: if the user navigates to an old entry and then a new transcription arrives, `historyIdx` is reset to `-1` and `resolvedIdx` correctly points to the new last entry regardless of the array length at the time of closure capture.

### Confidence Score: 9/10
All patterns are direct mirrors of existing code. The only uncertainty is the PowerShell `SendKeys` timing on very slow systems — if transcription takes long enough for the user to switch windows, the paste may land unexpectedly. This is by design and documented above.
