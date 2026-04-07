# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceToText Translator is a Windows desktop application built with Electron and TypeScript. It records the user's voice via microphone and transcribes it to text using a locally downloaded whisper.cpp model — fully offline, no cloud dependency. The UI is a minimal floating widget (~340×280px) with push-to-talk and toggle recording modes, a global hotkey (`Ctrl+Shift+Space`), and clipboard integration. Supports English and Norwegian.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Electron 33+ | Desktop app framework (Windows only) |
| TypeScript 5+ | Language (strict mode) |
| electron-vite | Build tool (dev server + bundling) |
| React 18+ | Renderer UI framework |
| whisper.cpp | Offline transcription via prebuilt Windows binary |
| Web MediaRecorder API | Mic capture in renderer process |
| audiobuffer-to-wav | Convert captured audio to 16kHz mono WAV |
| axios | Model download with progress streaming |
| Electron globalShortcut | Global hotkey registration |
| Electron clipboard | Clipboard write |
| electron-builder | Windows NSIS installer packaging |

---

## Commands

```bash
# Development
npm run dev       # Start Electron app with hot-reload (electron-vite)

# Build
npm run build     # Compile TypeScript + bundle via electron-vite

# Package
npm run package   # Build Windows NSIS installer via electron-builder → dist/
```

---

## Project Structure

```
VoiceToTextTranslator/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron main entry, BrowserWindow setup
│   │   ├── ipc.ts            # All ipcMain handlers
│   │   ├── transcriber.ts    # whisper.cpp child_process wrapper
│   │   ├── modelManager.ts   # Download, verify, list GGUF models
│   │   └── hotkey.ts         # globalShortcut registration
│   ├── renderer/
│   │   ├── index.html        # HTML shell (React mount point)
│   │   ├── main.tsx          # React entry point (ReactDOM.createRoot)
│   │   ├── App.tsx           # Root component, theme + routing
│   │   ├── components/       # Widget UI components
│   │   ├── hooks/            # Custom hooks (useRecorder, useTheme, etc.)
│   │   ├── recorder.ts       # MediaRecorder + WAV conversion
│   │   └── styles.css        # CSS variables, light/dark mode, base styles
│   └── preload/
│       └── index.ts          # contextBridge API surface
├── resources/
│   └── whisper/
│       └── main.exe          # Prebuilt whisper.cpp Windows binary
├── .claude/
│   ├── PRD.md                # Full product requirements document
│   ├── CLAUDE-template.md
│   └── commands/             # Slash command definitions
├── package.json
├── tsconfig.json
└── electron-builder.yml
```

---

## Architecture

Two Electron processes communicate via contextBridge IPC:

**Renderer process** — React app. Captures mic audio with `MediaRecorder`, resamples to 16kHz mono WAV, sends to main via IPC. Displays transcription result, manages UI state (light/dark mode, recording mode, language/model selection) via React state/hooks.

**Main process** — All heavy lifting. Handles IPC, invokes whisper.cpp binary via `child_process.spawn`, manages model files in `app.getPath('userData')/models/`, registers global hotkey, writes to clipboard.

**Preload** — Thin `contextBridge` layer. Exposes a typed `window.api` object to the renderer. No business logic here.

**whisper.cpp binary** — Called as a subprocess with args: model path, WAV file path, language flag (`-l en` or `-l no`). stdout is parsed for the transcription result. Temp WAV files are deleted after use.

**Models** — GGUF format, stored in userData/models/. Downloaded from Hugging Face on first launch. Users pick from: tiny / base / small / medium / large.

---

## Code Patterns

### Naming Conventions
- Files: `camelCase.ts` (e.g. `modelManager.ts`, `recorder.ts`)
- Types/Interfaces: `PascalCase` (e.g. `ModelInfo`, `DownloadProgress`)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for module-level constants

### IPC Pattern
- All `ipcMain.handle` calls live in `src/main/ipc.ts`
- All `contextBridge.exposeInMainWorld` calls live in `src/preload/index.ts`
- Renderer only calls `window.api.*` — never accesses Node APIs directly
- One-way events (e.g. download progress, hotkey press) use `ipcRenderer.on` / `webContents.send`

### File Organization
- Main process modules are single-responsibility: one file per concern
- Renderer modules mirror the same split: `recorder.ts` handles audio, `ui.ts` handles DOM state
- No shared runtime code between main and renderer (types only may be shared)

### Error Handling
- Main process: wrap child_process calls in try/catch, send error back to renderer via IPC reply
- Renderer: display user-facing error messages in the UI text area
- Never crash silently — log errors to `console.error` in dev, surface them to the user in prod

### whisper.cpp Invocation
```typescript
// Always resolve binary path relative to process.resourcesPath in production
const binaryPath = app.isPackaged
  ? path.join(process.resourcesPath, 'whisper', 'main.exe')
  : path.join(__dirname, '../../resources/whisper/main.exe')
```

### Theme
- Dark mode background: `#1e1e2e`, light text
- Light mode: white/light gray background, dark text
- Use CSS custom properties (`--bg`, `--text`, `--accent`) driven by `data-theme` attribute on `<html>` root
- Theme is set via IPC from `nativeTheme.shouldUseDarkColors` on startup — do not rely solely on `prefers-color-scheme`
- Manual toggle flips `data-theme` and persists to `localStorage`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | BrowserWindow creation, app lifecycle |
| `src/main/ipc.ts` | All IPC handler registrations |
| `src/main/transcriber.ts` | Spawns whisper.cpp, parses stdout |
| `src/main/modelManager.ts` | Lists, downloads, verifies GGUF models |
| `src/main/hotkey.ts` | Registers/unregisters `Ctrl+Shift+Space` |
| `src/preload/index.ts` | `window.api` contextBridge surface |
| `src/renderer/main.tsx` | React entry point |
| `src/renderer/App.tsx` | Root component, theme state |
| `src/renderer/hooks/` | Custom hooks (useRecorder, useTheme, etc.) |
| `src/renderer/recorder.ts` | MediaRecorder → 16kHz mono WAV |
| `resources/whisper/main.exe` | Prebuilt whisper.cpp binary (not compiled from source) |
| `electron-builder.yml` | Packaging config — includes whisper binary via `extraResources` |
| `.claude/PRD.md` | Full product spec — read this for feature context |

---

## On-Demand Context

| Topic | File |
|-------|------|
| Full product spec, UI layout, IPC API | `.claude/PRD.md` |
| Electron CSS/styling best practices (theming, titlebar, typography, scrollbars, DPI) | `.claude/skills/electron-styling/SKILL.md` |
| React component patterns (structure, hooks, state, TypeScript, useEffect, anti-patterns) | `.claude/skills/react-components/SKILL.md` |

---

## Notes

- **Windows only** — do not add cross-platform abstractions
- **No database, no auth, no telemetry** — keep it simple
- **React only in the renderer** — no other frontend frameworks
- **whisper.cpp binary path** must be resolved differently in dev vs packaged — always use the pattern in `transcriber.ts`
- Audio must be **16kHz, 16-bit, mono WAV** before passing to whisper.cpp — any other format will produce garbage output
- Models are large files (75MB–3GB) — always show download progress, never download silently
- The preload script is the **only** bridge between renderer and main — never use `nodeIntegration: true`
