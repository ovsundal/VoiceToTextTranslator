# Initialize Project

Run the following commands to set up and start the project locally:

## 1. Install Dependencies
```bash
npm install
```
Installs all Node.js packages defined in package.json.

## 2. Verify whisper.cpp Binary
Ensure the prebuilt Windows binary exists at:
```
resources/whisper/main.exe
```
If missing, download the latest whisper.cpp Windows release from the whisper.cpp GitHub releases page and place `main.exe` in that directory.

## 3. Start Development Server
```bash
npm run dev
```
Starts the Electron app in development mode via electron-vite with hot-reload.

## 4. Validate Setup

Check that everything is working:
- The app window opens (~340×280px widget)
- On first launch, the model picker screen is shown
- `Ctrl+Shift+Space` global hotkey is registered (check via a text editor in the background)

## Build for Production

```bash
npm run build
```
Compiles TypeScript and bundles the app via electron-vite.

```bash
npm run package
```
Packages the app into a Windows NSIS installer via electron-builder. Output is in the `dist/` directory.

## Project Structure

```
src/main/        → Electron main process (IPC, transcription, model management, hotkey)
src/renderer/    → UI (HTML/CSS/TypeScript widget)
src/preload/     → contextBridge API surface
resources/whisper/ → whisper.cpp prebuilt Windows binary
```

## Cleanup

No background services to stop. Close the Electron window or press `Ctrl+C` in the terminal to stop the dev server.
