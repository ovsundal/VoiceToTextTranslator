# Feature: Phase 3 — Recording & Transcription

The following plan should be complete, but validate documentation and codebase patterns and task sanity before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

---

## Feature Description

Wire up end-to-end voice recording and transcription. The renderer captures microphone audio via the Web MediaRecorder API, resamples it to 16 kHz mono WAV, and sends the raw audio buffer to the main process via IPC. The main process writes a temp WAV file, spawns the whisper.cpp binary with the selected model, parses stdout for the transcription result, cleans up the temp file, and returns the text to the renderer. The renderer displays the result in the main widget UI.

## User Story

As a user  
I want to click a Record button to capture my voice and see the transcription appear in the widget  
So that I can use offline voice-to-text without any cloud dependency

## Problem Statement

Phases 1–2 established the scaffold and model download flow. The app currently shows a placeholder message when a model is ready. Phase 3 must wire up the actual recording → transcription pipeline so the app fulfils its core purpose.

## Solution Statement

1. `src/renderer/recorder.ts` — capture mic with `MediaRecorder`, decode audio with `AudioContext`, resample to 16 kHz mono, encode as WAV, return `ArrayBuffer`.
2. `src/main/transcriber.ts` — accept a `Buffer` + model path + language, write temp WAV, spawn `whisper.cpp` binary, parse stdout, delete temp file, return text.
3. IPC wiring — expose `transcribe(wavBuffer, language, modelSize)` through preload.
4. `src/renderer/hooks/useRecorder.ts` — React hook managing `idle → recording → transcribing → idle` state.
5. `src/renderer/components/RecordingWidget.tsx` — main widget: language picker, model picker, text area, record button.
6. Update `App.tsx` to render `RecordingWidget` when `appState === 'ready'`.

Hotkey, clipboard, push-to-talk mode, and auto-copy are **Phase 4** — do not implement them here.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: main/transcriber, main/ipc, preload, renderer/recorder, renderer/hooks, renderer/components  
**Dependencies**: `audiobuffer-to-wav` (new npm dep), `whisper/main.exe` (already in resources/)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `src/main/ipc.ts` (full file) — contains TODO Phase 3 stubs; add handlers here, nowhere else
- `src/main/modelManager.ts` (lines 15–36) — `getModelsDir()` and `listModels()` patterns; transcriber calls `listModels()` to resolve model path
- `src/preload/index.ts` (full file) — existing IPC pattern; follow exactly for new `transcribe` channel
- `src/renderer/App.tsx` (full file) — replace the Phase 2 placeholder `<p>` with `<RecordingWidget>`
- `src/renderer/components/ModelSetup.tsx` (full file) — component pattern to mirror for `RecordingWidget`
- `src/renderer/styles.css` (full file) — all CSS variables already defined; append widget styles at the end
- `src/types/models.ts` (full file) — existing types; add `TranscribeResult` type here
- `src/types/electron.d.ts` (full file) — `Window.api` type auto-derived from preload; no changes needed

### New Files to Create

- `src/main/transcriber.ts` — whisper.cpp child_process wrapper
- `src/renderer/recorder.ts` — MediaRecorder → 16 kHz mono WAV ArrayBuffer
- `src/renderer/hooks/useRecorder.ts` — recording state machine hook
- `src/renderer/components/RecordingWidget.tsx` — main recording + transcription UI

### Relevant Documentation — READ BEFORE IMPLEMENTING

- Web MediaRecorder API: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
  - Sections: `start()`, `stop()`, `ondataavailable` — captures audio chunks into a Blob
- Web Audio API — OfflineAudioContext for resampling: https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
  - Why: only way to resample from 48 kHz (mic default) to 16 kHz without a native addon
- `audiobuffer-to-wav` npm package: https://www.npmjs.com/package/audiobuffer-to-wav
  - Why: encodes a decoded AudioBuffer into a WAV ArrayBuffer with correct headers
- Electron IPC (handle/invoke): https://www.electronjs.org/docs/latest/api/ipc-main#ipcmainhandlechannel-listener
  - Why: `ipcMain.handle` / `ipcRenderer.invoke` pattern used for all async IPC in this project
- Node.js child_process.spawn: https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
  - Why: whisper.cpp invoked as a subprocess; stdout parsed for result

### Patterns to Follow

**IPC Handler (from `src/main/ipc.ts`):**
```typescript
ipcMain.handle('listModels', () => listModels())
```
Add `transcribe` handler in the same `registerIpcHandlers` function.

**IPC Preload Exposure (from `src/preload/index.ts`):**
```typescript
listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('listModels'),
```
Follow this exact pattern for `transcribe`.

**Binary Path Resolution (from CLAUDE.md — MANDATORY):**
```typescript
const binaryPath = app.isPackaged
  ? join(process.resourcesPath, 'whisper', 'main.exe')
  : join(__dirname, '../../resources/whisper/main.exe')
```
Use this in `transcriber.ts`. Do NOT use `__dirname` alone in production.

**Component Structure (from `src/renderer/components/ModelSetup.tsx`):**
- Functional component with typed props interface
- `useEffect` for IPC subscriptions with cleanup return
- `window.api.*` calls only — no direct Node/Electron imports

**React Hook Pattern:**
- Hooks live in `src/renderer/hooks/`
- Single responsibility per hook file
- Return typed object, not array

**Error Handling:**
- Main process: wrap spawn in try/catch, throw `Error` with message — IPC invoke propagates it to renderer
- Renderer: catch IPC errors and display in text area (not alert/console only)

**CSS Pattern:**
- Use existing CSS variables only (`--bg`, `--bg-secondary`, `--text`, `--text-secondary`, `--accent`, `--accent-danger`, `--border`)
- Append new rules to end of `styles.css` — do not reorganise existing rules
- Class names: kebab-case, prefixed by component (e.g. `.widget-*`, `.record-*`)

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Install the new npm dependency and create the types needed by transcription.

**Tasks:**
- Install `audiobuffer-to-wav`
- Add `TranscribeResult` type / extend types if needed

### Phase 2: Core Implementation

Build the two new modules independently, then wire IPC.

**Tasks:**
- `src/main/transcriber.ts` — spawn whisper.cpp, parse output
- `src/renderer/recorder.ts` — capture audio, resample, encode WAV

### Phase 3: IPC Wiring

Connect renderer → main through preload.

**Tasks:**
- `src/main/ipc.ts` — add `transcribe` handler
- `src/preload/index.ts` — expose `transcribe` on `window.api`

### Phase 4: UI

Build the React hook and widget component, replace placeholder in App.tsx.

**Tasks:**
- `src/renderer/hooks/useRecorder.ts`
- `src/renderer/components/RecordingWidget.tsx`
- `src/renderer/App.tsx` — swap placeholder for `<RecordingWidget>`
- `src/renderer/styles.css` — append widget styles

---

## STEP-BY-STEP TASKS

### TASK 1 — ADD `audiobuffer-to-wav` to package.json

- **IMPLEMENT**: Run `npm install audiobuffer-to-wav` in the project root
- **GOTCHA**: The package has no bundled TypeScript types. Add a minimal ambient declaration in `src/types/audiobuffer-to-wav.d.ts`: `declare module 'audiobuffer-to-wav' { export default function toWav(buffer: AudioBuffer, opts?: { float32?: boolean }): ArrayBuffer }`
- **VALIDATE**: `npm ls audiobuffer-to-wav` — should show version

### TASK 2 — CREATE `src/main/transcriber.ts`

- **IMPLEMENT**: Export `async function transcribe(wavBuffer: Buffer, modelPath: string, language: 'en' | 'no'): Promise<string>`
- **IMPLEMENT**: Write WAV buffer to `join(tmpdir(), 'vtt-' + Date.now() + '.wav')` using `writeFileSync`
- **IMPLEMENT**: Resolve binary path with the mandatory pattern from CLAUDE.md (dev vs packaged)
- **IMPLEMENT**: Spawn: `spawn(binaryPath, ['-m', modelPath, '-f', tmpPath, '-l', language, '-nt'])` — `-nt` suppresses timestamps in output
- **IMPLEMENT**: Accumulate `proc.stdout` data events into a string; reject on non-zero exit code using `proc.stderr` content as the error message
- **IMPLEMENT**: Delete temp WAV in a `finally` block using `unlinkSync` (guard with `existsSync`)
- **PATTERN**: Binary path pattern — `src/main/transcriber.ts` (see CLAUDE.md whisper.cpp Invocation section)
- **IMPORTS**: `{ app }` from `'electron'`, `{ join }` from `'path'`, `{ spawn }` from `'child_process'`, `{ writeFileSync, unlinkSync, existsSync }` from `'fs'`, `{ tmpdir }` from `'os'`
- **GOTCHA**: whisper.cpp stdout may include lines beginning with `[` (timestamps) even with `-nt` if the binary version differs — filter lines that start with `[` when parsing output just in case
- **GOTCHA**: `proc` events fire after `spawn` returns — wrap in `new Promise<string>` and resolve/reject inside event handlers
- **VALIDATE**: `npm run build` — TypeScript must compile without errors

### TASK 3 — UPDATE `src/main/ipc.ts` — add transcribe handler

- **ADD**: Import `transcribe` from `'./transcriber'`; import `listModels` (already imported)
- **ADD**: Remove the TODO comment for Phase 3 transcribe and add:
  ```typescript
  ipcMain.handle('transcribe', async (_, wavBuffer: ArrayBuffer, language: string, modelSize: string) => {
    const models = listModels()
    const model = models.find(m => m.size === modelSize && m.downloaded)
    if (!model?.path) throw new Error(`Model '${modelSize}' not found or not downloaded`)
    return transcribe(Buffer.from(wavBuffer), model.path, language as 'en' | 'no')
  })
  ```
- **PATTERN**: `src/main/ipc.ts:11` — `ipcMain.handle('listModels', () => listModels())`
- **GOTCHA**: `wavBuffer` arrives as `ArrayBuffer` over IPC — must wrap with `Buffer.from()` before passing to `transcribe()`
- **VALIDATE**: `npm run build`

### TASK 4 — UPDATE `src/preload/index.ts` — expose transcribe

- **ADD**: Remove the TODO Phase 3 transcription comment and add to the `api` object:
  ```typescript
  transcribe: (wavBuffer: ArrayBuffer, language: 'en' | 'no', modelSize: string): Promise<string> =>
    ipcRenderer.invoke('transcribe', wavBuffer, language, modelSize),
  ```
- **PATTERN**: `src/preload/index.ts:17` — `listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('listModels')`
- **GOTCHA**: `ArrayBuffer` transfers correctly over IPC via `ipcRenderer.invoke` — no manual serialization needed
- **VALIDATE**: `npm run build` — the `ElectronAPI` type is auto-derived via `typeof api`, so `window.api.transcribe` will be typed automatically

### TASK 5 — CREATE `src/renderer/recorder.ts`

- **IMPLEMENT**: Export `async function recordAudio(): Promise<{ start: () => void; stop: () => Promise<ArrayBuffer> }>`
  - Request mic via `navigator.mediaDevices.getUserMedia({ audio: true, video: false })`
  - Create `MediaRecorder` with the stream; collect `ondataavailable` chunks into an array
  - `start()` calls `mediaRecorder.start()`
  - `stop()` returns a Promise that resolves with the resampled WAV ArrayBuffer:
    1. Call `mediaRecorder.stop()` — listen for `onstop` event to know chunks are complete
    2. Assemble `new Blob(chunks)` from collected chunks
    3. Decode: `const audioCtx = new AudioContext(); const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer())`
    4. Resample to 16 kHz: create `OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)`, connect a `BufferSourceNode`, render
    5. Encode: `import toWav from 'audiobuffer-to-wav'; return toWav(renderedBuffer)`
    6. Close `audioCtx` after use: `audioCtx.close()`
    7. Stop all media stream tracks after getting the WAV
- **GOTCHA**: `OfflineAudioContext` takes `(numberOfChannels, length, sampleRate)` — pass `1` for mono (downmix happens automatically since we're mixing all channels into one)
- **GOTCHA**: `MediaRecorder.stop()` is asynchronous — the `onstop` event fires when all chunks are flushed; do NOT read chunks before `onstop` fires
- **GOTCHA**: `decodeAudioData` throws if the blob is empty (user stopped immediately) — wrap in try/catch and throw a user-friendly error
- **IMPORTS**: `import toWav from 'audiobuffer-to-wav'` (renderer-side, bundled by Vite)
- **VALIDATE**: `npm run build`

### TASK 6 — CREATE `src/renderer/hooks/useRecorder.ts`

- **IMPLEMENT**: Export `function useRecorder()` returning:
  ```typescript
  {
    status: 'idle' | 'recording' | 'transcribing' | 'error',
    transcript: string,
    error: string | null,
    selectedLanguage: 'en' | 'no',
    setSelectedLanguage: (l: 'en' | 'no') => void,
    selectedModelSize: ModelSize,
    setSelectedModelSize: (s: ModelSize) => void,
    downloadedModels: ModelInfo[],
    toggleRecording: () => void,
  }
  ```
- **IMPLEMENT** state:
  - `status`, `transcript`, `error` — recording pipeline state
  - `selectedLanguage: 'en' | 'no'` — defaults to `'en'`
  - `selectedModelSize: ModelSize` — defaults to first downloaded model from `listModels()`
  - `downloadedModels: ModelInfo[]` — populated on mount via `window.api.listModels()`
- **IMPLEMENT** `toggleRecording`:
  - If `status === 'idle'`: call `recordAudio()` to get `{ start, stop }`, store in ref, call `start()`, set status to `'recording'`
  - If `status === 'recording'`: call `stop()` → get `wavBuffer: ArrayBuffer`, set status to `'transcribing'`, call `window.api.transcribe(wavBuffer, selectedLanguage, selectedModelSize)` → set `transcript`, set status to `'idle'`
  - Wrap in try/catch; on error: set `error` message, set status to `'error'`
- **GOTCHA**: Store the `{ start, stop }` object from `recordAudio()` in a `useRef` (not state) to avoid re-renders
- **GOTCHA**: `toggleRecording` captures stale state if defined as a regular function inside the component — use `useCallback` with `[status, selectedLanguage, selectedModelSize]` dependencies
- **PATTERN**: Hook file naming — `src/renderer/hooks/useRecorder.ts` (camelCase, `use` prefix)
- **IMPORTS**: `{ useState, useRef, useEffect, useCallback }` from `'react'`, `{ recordAudio }` from `'../recorder'`, `{ ModelSize, ModelInfo }` from `'../../types/models'`
- **VALIDATE**: `npm run build`

### TASK 7 — CREATE `src/renderer/components/RecordingWidget.tsx`

- **IMPLEMENT**: Functional component `export default function RecordingWidget()` — no props needed (all state from `useRecorder`)
- **LAYOUT** (matches PRD wireframe):
  ```
  [Language ▾]  [Model ▾]
  ┌──────────────────────┐
  │ transcript text area  │
  └──────────────────────┘
  [         ⏺ Record    ]
  status indicator line
  ```
- **IMPLEMENT** language selector: `<select>` with options `en` / `no` (displayed as "English" / "Norwegian")
- **IMPLEMENT** model selector: `<select>` populated from `downloadedModels` — each option is `m.size`, displayed as `m.label`
- **IMPLEMENT** text area: `<textarea readOnly value={transcript}` className `widget-transcript` — shows placeholder text when empty
- **IMPLEMENT** record button: `<button onClick={toggleRecording}` — label "⏺ Record" when idle/error, "⏹ Stop" when recording, "⏳ Transcribing..." when transcribing — disabled when `status === 'transcribing'`
- **IMPLEMENT** status line: `<p className="widget-status">` — shows error message when `status === 'error'`, empty otherwise
- **GOTCHA**: Record button should be `className="btn-primary"` but with a red accent when `status === 'recording'` — add an inline style override `{ background: 'var(--accent-danger)' }` when recording
- **PATTERN**: `src/renderer/components/ModelSetup.tsx` — component structure, className usage
- **IMPORTS**: `{ useRecorder }` from `'../hooks/useRecorder'`
- **VALIDATE**: `npm run build`

### TASK 8 — UPDATE `src/renderer/App.tsx` — render RecordingWidget

- **UPDATE**: Replace the Phase 2 placeholder block:
  ```tsx
  {appState === 'ready' && (
    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
      Phase 2 complete — model ready. Recording UI coming in Phase 3.
    </p>
  )}
  ```
  with:
  ```tsx
  {appState === 'ready' && <RecordingWidget />}
  ```
- **ADD**: Import `RecordingWidget` from `'./components/RecordingWidget'`
- **VALIDATE**: `npm run build`

### TASK 9 — UPDATE `src/renderer/styles.css` — append widget styles

- **ADD** at end of file (do not touch existing rules):
  ```css
  /* Recording Widget */
  .widget-toolbar {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .widget-toolbar select {
    flex: 1;
    padding: 4px 6px;
    background: var(--bg-secondary);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .widget-transcript {
    flex: 1;
    width: 100%;
    resize: none;
    padding: 8px;
    background: var(--bg-secondary);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.5;
  }

  .widget-transcript::placeholder {
    color: var(--text-secondary);
  }

  .widget-status {
    font-size: 11px;
    color: var(--accent-danger);
    margin: 4px 0 0;
    min-height: 16px;
  }
  ```
- **VALIDATE**: Visual check in `npm run dev`

---

## TESTING STRATEGY

No automated test framework is configured in this project. Validation is manual + TypeScript compiler.

### Unit Tests

N/A — no test runner configured.

### Integration Tests

N/A

### Edge Cases to Manually Verify

1. **Empty recording** — user clicks Record and immediately Stop; should show a clean error (not crash)
2. **Wrong model** — if `selectedModelSize` references a model that was deleted from disk between sessions; should surface an error in the widget status line
3. **whisper.cpp not found** — if `resources/whisper/main.exe` is missing in dev; error surfaces in widget
4. **Long audio** — 30+ second recording; transcription takes time; button must stay in "Transcribing..." state throughout
5. **Mic permission denied** — `getUserMedia` rejects; error displayed in widget, status resets to `'error'`
6. **Theme toggle during recording** — must not interrupt recording

---

## VALIDATION COMMANDS

### Level 1: TypeScript compilation

```bash
npm run build
```
Expected: exits 0 with no TypeScript errors.

### Level 2: Dev server smoke test

```bash
npm run dev
```
Expected: app launches, shows widget when model is downloaded. Record button is visible. Click Record → mic access prompt → recording starts. Click Stop → transcription appears.

### Level 3: Manual end-to-end validation checklist

- [ ] App launches to RecordingWidget (not the Phase 2 placeholder) when a model is downloaded
- [ ] Language dropdown shows English / Norwegian
- [ ] Model dropdown shows only downloaded models
- [ ] Clicking Record changes button label to "⏹ Stop" and button turns red
- [ ] Clicking Stop changes button to "⏳ Transcribing..." (disabled)
- [ ] Transcription text appears in the text area after processing
- [ ] Error state shown in status line (not a crash) when mic is denied
- [ ] Theme toggle works during any state
- [ ] `npm run build` exits 0 with no errors after all tasks complete

---

## ACCEPTANCE CRITERIA

- [ ] `src/main/transcriber.ts` exists, exports `transcribe(wavBuffer, modelPath, language)`
- [ ] `src/renderer/recorder.ts` exists, exports `recordAudio()` returning `{ start, stop }`
- [ ] `src/renderer/hooks/useRecorder.ts` exists, exports `useRecorder()`
- [ ] `src/renderer/components/RecordingWidget.tsx` exists, renders language picker, model picker, transcript area, record button
- [ ] `window.api.transcribe` is exposed in preload and typed
- [ ] `ipcMain.handle('transcribe', ...)` is registered in `ipc.ts`
- [ ] `App.tsx` renders `<RecordingWidget />` when `appState === 'ready'`
- [ ] `npm run build` passes with 0 TypeScript errors
- [ ] End-to-end transcription works in `npm run dev`
- [ ] Mic permission denied shows error in UI (no crash)
- [ ] Phase 2 model setup still works (no regression)

---

## COMPLETION CHECKLIST

- [ ] All 9 tasks completed in order
- [ ] Each task validated immediately after completion
- [ ] `npm run build` passes after Task 9
- [ ] Manual end-to-end test passes in `npm run dev`
- [ ] No linting or type errors
- [ ] Phase 2 model setup flow regression-free

---

## NOTES

- **`audiobuffer-to-wav` types**: the package ships no `.d.ts`; add `src/types/audiobuffer-to-wav.d.ts` with a minimal ambient module declaration (see Task 1).
- **Resampling approach**: We use `OfflineAudioContext` for resampling rather than a native addon. This is pure browser API, works in Electron's renderer, and requires no additional build tooling.
- **Model path resolution**: `transcribe()` accepts `modelPath` as a parameter (supplied by the IPC handler from `listModels()`). This keeps `transcriber.ts` free of model-management concerns.
- **Phase 4 stubs**: After Phase 3 is complete, `preload/index.ts` will still have TODO comments for hotkey and clipboard — leave them in place; they are Phase 4's responsibility.
- **whisper.cpp `-nt` flag**: suppresses timestamp brackets `[00:00.000 --> 00:00.500]` in stdout. Still filter lines beginning with `[` defensively in case the binary version differs.
- **Window size**: the widget at 340×280px is tight. `RecordingWidget` must use flex column layout so the transcript area grows to fill available space. Use `flex: 1` on the `<textarea>`.
