# PRD: VoiceToText Translator

## 1. Executive Summary

VoiceToText Translator is a lightweight Windows desktop application built with Electron, React, and TypeScript that lets users record their voice and transcribe it to text using a locally downloaded Whisper model. There is no cloud dependency — all processing happens on-device. The app is designed as a minimal floating widget that stays out of the way, with a focus on speed, simplicity, and privacy.

The MVP goal is a fully functional offline voice-to-text app supporting English and Norwegian, with push-to-talk and toggle recording modes, a global hotkey, and one-click copy to clipboard.

---

## 2. Mission

Enable fast, private, offline voice transcription on Windows without any accounts, internet dependency, or complex setup.

**Core principles:**
- Offline-first: all transcription runs locally
- Minimal footprint: small widget UI, out of the way
- Fast to use: global hotkey, one-click copy
- User in control: pick your model, pick your language
- No telemetry, no accounts, no database

---

## 3. Target Users

- Windows users who want to dictate text into any application
- Users who care about privacy and don't want cloud-based transcription
- Norwegian and English speakers
- Non-technical users who want a simple, install-and-use experience

---

## 4. MVP Scope

### In Scope ✅
- ✅ Electron app (Windows only)
- ✅ Offline transcription via whisper.cpp (prebuilt Windows binary)
- ✅ English and Norwegian language support
- ✅ Model selection: tiny, base, small, medium, large (GGUF format)
- ✅ First-launch model picker + download flow with progress
- ✅ Push-to-talk recording mode
- ✅ Toggle recording mode
- ✅ Global hotkey: `Ctrl+Shift+Space`
- ✅ Minimal floating widget UI
- ✅ Light and dark mode (follows system preference, manually toggleable)
- ✅ Transcription displayed in app
- ✅ Copy to clipboard button
- ✅ Auto-copy to clipboard toggle
- ✅ Window opens on launch (not minimized/tray)
- ✅ Window is NOT always-on-top
- ✅ No authentication
- ✅ No database / no persistent transcription history

### Out of Scope ❌
- ❌ macOS / Linux support
- ❌ Real-time / streaming transcription
- ❌ Translation (speech in one language → text in another)
- ❌ System tray mode
- ❌ Transcription history saved to disk
- ❌ Voice activity detection (auto start/stop)
- ❌ Cloud transcription fallback
- ❌ Speaker diarization

---

## 5. User Stories

1. **As a user**, I want to hold `Ctrl+Shift+Space` to record my voice, so I can transcribe without touching the app window.
2. **As a user**, I want to toggle recording on/off with a button click, so I have a hands-free alternative to push-to-talk.
3. **As a user**, I want to see my transcribed text appear in the app, so I can review it before copying.
4. **As a user**, I want to click a copy button to copy the transcription to clipboard, so I can paste it anywhere.
5. **As a user**, I want to enable auto-copy, so transcriptions are automatically sent to my clipboard without an extra click.
6. **As a user**, I want to pick my transcription model (tiny → large), so I can balance speed vs. accuracy.
7. **As a user**, I want to select English or Norwegian before recording, so I get accurate transcription in my language.
8. **As a user**, I want the app to prompt me to download a model on first launch, so setup is guided and clear.
9. **As a user**, I want light and dark mode, so the widget fits my desktop theme.

---

## 6. Architecture

### Process Architecture

```
┌─────────────────────────────────────────────────┐
│  Renderer Process (UI)                           │
│  - Minimal floating widget (HTML/CSS/TS)         │
│  - MediaRecorder API (mic capture)               │
│  - Audio resampling → 16kHz mono WAV             │
│  - Language picker (EN / NO)                     │
│  - Model picker + download progress UI           │
│  - Recording controls (push-to-talk / toggle)    │
│  - Transcription output area                     │
│  - Copy button + auto-copy toggle                │
│  - Light / dark mode toggle                      │
└──────────────┬──────────────────────────────────┘
               │ contextBridge IPC
┌──────────────▼──────────────────────────────────┐
│  Main Process                                    │
│  - BrowserWindow management                      │
│  - globalShortcut: Ctrl+Shift+Space              │
│  - IPC handlers (record, transcribe, download)   │
│  - WAV file write to temp dir                    │
│  - whisper.cpp binary (child_process.spawn)      │
│  - Model file management (userData dir)          │
│  - Model download (axios + progress streaming)   │
│  - Clipboard write (electron clipboard API)      │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
VoiceToTextTranslator/
├── src/
│   ├── main/
│   │   ├── index.ts           # Electron main entry, BrowserWindow setup
│   │   ├── ipc.ts             # All ipcMain handlers
│   │   ├── transcriber.ts     # whisper.cpp child_process wrapper
│   │   ├── modelManager.ts    # Download, verify, list models
│   │   └── hotkey.ts          # globalShortcut registration
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.ts            # Renderer entry point
│   │   ├── recorder.ts        # MediaRecorder + WAV conversion
│   │   ├── ui.ts              # UI state management
│   │   └── styles.css         # Light/dark mode, widget styles
│   └── preload/
│       └── index.ts           # contextBridge API surface
├── resources/
│   └── whisper/
│       └── main.exe           # Prebuilt whisper.cpp Windows binary
├── PRD.md
├── package.json
├── tsconfig.json
└── electron-builder.yml
```

### Model Storage

Models are stored in `app.getPath('userData')/models/`. On first launch, no model exists and the app presents a model picker with download. Models are GGUF format sourced from Hugging Face (ggerganov/whisper.cpp).

---

## 7. Features

### 7.1 Model Setup (First Launch)

- Detect if any model exists in userData/models/
- If none: show model selection screen with size/accuracy tradeoff info
- User picks a model (tiny / base / small / medium / large)
- Show download progress bar (file size, % complete, speed)
- On complete: transition to main widget UI

### 7.2 Recording

**Push-to-talk:**
- Hold `Ctrl+Shift+Space` (global hotkey) OR hold the Record button in UI
- Recording starts on press, stops and transcribes on release

**Toggle mode:**
- Click Record button or press `Ctrl+Shift+Space` to start
- Click again or press hotkey again to stop and transcribe

**Both modes:**
- Visual indicator while recording (button state change, color)
- Audio captured via `MediaRecorder` at 48kHz, converted to 16kHz mono WAV
- WAV file written to OS temp dir, passed to whisper.cpp

### 7.3 Transcription

- whisper.cpp binary invoked via `child_process.spawn`
- Arguments: model path, WAV file, language flag (`-l en` or `-l no`)
- stdout parsed for transcription text
- Result displayed in text area in app
- Temp WAV file deleted after transcription

### 7.4 Output

- Transcription text shown in scrollable text area
- "Copy" button copies text to clipboard
- Auto-copy toggle: when ON, text is copied to clipboard automatically on transcription complete
- Text area is cleared on next recording start

### 7.5 Settings (in widget)

- Language selector: English / Norwegian
- Model selector: shows downloaded models, option to download more
- Auto-copy toggle
- Push-to-talk vs Toggle mode selector
- Light/dark mode toggle

---

## 8. Technology Stack

| Layer | Technology |
|---|---|
| App framework | Electron 33+ |
| Language | TypeScript 5+ |
| Build tool | electron-vite |
| Renderer UI | React 18+ with TypeScript |
| Transcription | whisper.cpp (prebuilt Windows binary) |
| Audio capture | Web MediaRecorder API |
| Audio conversion | audiobuffer-to-wav + custom 16kHz resampler |
| Model download | axios (with progress events) |
| Global hotkey | Electron globalShortcut |
| Clipboard | Electron clipboard API |
| Temp files | Node.js fs + os.tmpdir() |
| Packaging | electron-builder (NSIS installer) |

---

## 9. UI Design

### Widget Dimensions
- Width: ~340px
- Height: ~280px (expands slightly during model setup)
- Resizable: no

### Layout

```
┌──────────────────────────────────┐
│  VoiceToText            🌙  −  ✕ │  ← title bar, dark mode toggle
├──────────────────────────────────┤
│  [English ▾]   [tiny ▾]          │  ← language + model dropdowns
├──────────────────────────────────┤
│  ┌──────────────────────────────┐ │
│  │                              │ │
│  │  Transcribed text appears    │ │  ← scrollable text area
│  │  here after recording.       │ │
│  │                              │ │
│  └──────────────────────────────┘ │
│  [📋 Copy]        Auto-copy [●]   │  ← copy btn + auto-copy toggle
├──────────────────────────────────┤
│  Mode: [Push-to-talk] [Toggle]    │  ← recording mode selector
│  [         ⏺ Record         ]    │  ← record button (hold or click)
└──────────────────────────────────┘
```

### Theme
- Dark mode: dark background (#1e1e2e), light text, accent color for record button
- Light mode: white/light gray background, dark text
- Follows system preference on launch, manually overridable via toggle

---

## 10. IPC API (preload contextBridge)

```typescript
window.api = {
  // Recording
  startRecording: () => void
  stopRecording: () => Promise<void>

  // Transcription
  transcribe: (wavPath: string, language: 'en' | 'no') => Promise<string>

  // Models
  listModels: () => Promise<ModelInfo[]>
  downloadModel: (size: ModelSize) => void
  onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void

  // Hotkey
  onHotkeyPressed: (cb: () => void) => void
  onHotkeyReleased: (cb: () => void) => void

  // Clipboard
  copyToClipboard: (text: string) => void
}
```

---

## 11. Success Criteria

- ✅ App launches and prompts model download on first run
- ✅ User can record with push-to-talk (hold `Ctrl+Shift+Space`)
- ✅ User can record with toggle (click button or hotkey)
- ✅ Global hotkey works when app is not in focus
- ✅ Transcription appears in app within a reasonable time after recording stops
- ✅ Copy to clipboard works manually and via auto-copy toggle
- ✅ English and Norwegian both produce accurate transcriptions
- ✅ User can switch model without restarting app
- ✅ Light and dark mode both look polished
- ✅ App packages to a Windows installer (.exe)

---

## 12. Implementation Phases

### Phase 1: Project Scaffold
- electron-vite + TypeScript setup
- BrowserWindow config (correct sizing, no frame or custom frame)
- contextBridge preload skeleton
- Basic renderer HTML/CSS shell (light + dark mode)

### Phase 2: Model Management
- modelManager.ts: list, download, verify models
- First-launch detection and model picker screen
- Download progress UI

### Phase 3: Recording & Transcription
- recorder.ts: MediaRecorder → WAV conversion → temp file
- transcriber.ts: whisper.cpp child_process wrapper
- IPC wiring: renderer triggers record → main transcribes → result back to renderer

### Phase 4: Hotkey & Output
- globalShortcut registration (Ctrl+Shift+Space)
- Push-to-talk vs toggle logic
- Clipboard copy + auto-copy toggle
- Language and model selectors wired up

### Phase 5: Polish & Packaging
- UI polish, animations, error states
- electron-builder config for Windows NSIS installer
- Include whisper.cpp binary in packaged app
- Test on clean Windows machine

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| whisper.cpp binary not found in packaged app | Use `extraResources` in electron-builder config; resolve path relative to `process.resourcesPath` |
| Audio format mismatch (wrong sample rate) | Enforce 16kHz mono WAV conversion in renderer before sending to main |
| Model download fails mid-way | Detect incomplete files by size check; delete and re-prompt on next launch |
| Global hotkey conflicts with other apps | Let user reconfigure hotkey in future; document known conflicts in README |
| Large models slow on CPU | Clearly label expected transcription time per model size in the picker UI |
