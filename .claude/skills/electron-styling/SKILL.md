---
name: electron-styling
description: Best practices for styling Electron desktop apps with vanilla HTML/CSS — theming, custom titlebar, typography, scrollbars, transitions, and DPI scaling. Reference when writing or reviewing renderer CSS/HTML for this project.
---

# Electron Frontend Styling Best Practices

## CSS Architecture

- Use **CSS custom properties** for all theme colors and dynamic values
- **Flat selectors** over BEM for small widget UIs — keep specificity low
- **Minimal CSS reset**: `box-sizing: border-box` globally, remove default margins. Avoid heavy resets — Electron's Chromium context is already clean
- Do **not** rely on `@media (prefers-color-scheme)` alone — Electron apps need explicit theme switching via IPC from `nativeTheme`

---

## Light/Dark Mode

Apply `data-theme` on the `<html>` root and drive all colors through CSS variables:

```css
:root[data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f5f5f5;
  --text: #1a1a1a;
  --text-secondary: #666666;
  --accent: #5865f2;
  --thumb-color: #cccccc;
  --thumb-hover: #aaaaaa;
}

:root[data-theme="dark"] {
  --bg: #1e1e2e;
  --bg-secondary: #2a2a3e;
  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --accent: #89b4fa;
  --thumb-color: #45475a;
  --thumb-hover: #585b70;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

**Implementation flow:**
1. In main process: read `nativeTheme.shouldUseDarkColors` on startup
2. Send theme via IPC to renderer before window shows
3. Renderer applies `document.documentElement.dataset.theme = 'dark' | 'light'`
4. Listen to `nativeTheme.on('updated')` in main → send update to renderer
5. Manual toggle: flip `data-theme` and persist preference to `localStorage`

---

## Custom Titlebar

Set `frame: false` in BrowserWindow, then build the titlebar in HTML:

```html
<div class="titlebar">
  <span class="titlebar-title">VoiceToText</span>
  <div class="titlebar-controls">
    <button class="btn-minimize">−</button>
    <button class="btn-close">✕</button>
  </div>
</div>
```

```css
.titlebar {
  -webkit-app-region: drag;
  height: 32px; /* matches Windows native titlebar height */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}

.titlebar-controls {
  -webkit-app-region: no-drag; /* REQUIRED — buttons must be clickable */
}
```

**Pitfalls:**
- Every interactive element inside a drag region (buttons, inputs, links) needs `-webkit-app-region: no-drag`
- Never set drag on the full window — content becomes unclickable
- Use `ipcRenderer.send('minimize')` / `'close'` in button handlers → `win.minimize()` / `win.close()` in main

---

## Typography

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Helvetica Neue', sans-serif;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
```

- **Segoe UI** is the Windows native UI font — always include it first after the system stack
- Compact widget base: `13px` body, `11px` for secondary/meta text, `14-15px` for primary output text
- Use `font-weight: 500` for buttons and labels to avoid aliasing artifacts on Windows

---

## Scrollbars

Chromium (and therefore Electron) fully supports `::-webkit-scrollbar`:

```css
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

- Keep width **6–8px** for compact widgets
- Electron does **not** auto-invert scrollbar colors with theme — always set explicitly via CSS variables
- `background: transparent` on the track keeps it minimal

---

## Transitions & Micro-interactions

```css
/* Button state */
.btn-record {
  background: var(--accent);
  transition: background-color 150ms ease-out,
              transform 100ms ease-out;
}

.btn-record:active {
  transform: scale(0.97);
}

.btn-record.recording {
  background: #f38ba8; /* danger/recording color */
}

/* Theme switch */
body {
  transition: background-color 200ms ease, color 200ms ease;
}
```

- **Safe durations**: 100–150ms for interactive feedback, 200ms for theme switch
- Avoid transitions on properties that change frequently (e.g. width during resize)
- Use `ease-out` for interactive elements — feels snappier than `ease`
- GPU-accelerate only `opacity` and `transform` with `will-change` — avoid on others

---

## DPI Scaling (Windows 125% / 150%)

- Set fixed window dimensions in **BrowserWindow** — Electron handles DPI scaling transparently:
  ```typescript
  new BrowserWindow({ width: 340, height: 280 })
  ```
- Use **even pixel multiples** for window dimensions to avoid subpixel blur on high-DPI
- Do **not** use `window.devicePixelRatio` in CSS — Chromium auto-scales
- Avoid `px` borders thinner than `1px` — use `1px solid` minimum
- Test at Windows Display Settings → 125% and 150% scale before shipping

---

## Quick Checklist

- [ ] CSS variables for all colors (`--bg`, `--text`, `--accent`, `--thumb-color`, etc.)
- [ ] `data-theme` attribute on `<html>` root (not `<body>`)
- [ ] IPC sync `nativeTheme` → renderer on startup and on `updated` event
- [ ] Minimal CSS reset — `box-sizing: border-box` only
- [ ] Titlebar 32px, drag region set, all controls marked `no-drag`
- [ ] Segoe UI in font stack, `13px` base size
- [ ] Custom `::-webkit-scrollbar` with CSS variable colors
- [ ] Max 150ms transitions on interactive elements, 200ms for theme
- [ ] Window size set to even pixel multiples
- [ ] Test rendering at 125% and 150% Windows DPI
