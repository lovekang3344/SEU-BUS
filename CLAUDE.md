# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev            # Start Vite dev server (web mode)
pnpm build          # Build Vue app for production (output: dist/)
pnpm preview        # Preview production build
pnpm electron:dev   # Start Electron desk pet in dev mode (needs Vite server running)
pnpm dist           # Build Vue app + package Electron installer (release/)
```

All commands use `pnpm`. The project uses Vite 5 + Vue 3 with Tailwind CSS + Electron.

## Architecture

This is a **dual-mode Vue 3 app** — it runs both as a web app (in browser) and as a Windows desktop "desk pet" (via Electron). Mode detection is in `App.vue`: if `window.electronAPI.isElectron` is truthy, it renders `<DeskPet>` instead of the full web UI.

### Key files

- `src/App.vue` — Root component; conditionally renders either the original web UI or `<DeskPet>` based on Electron detection. Web mode retains all original logic (schedule loading, holiday detection, alarms).
- `src/components/DeskPet.vue` — **New desk pet component**. A small frameless Electron window containing a CSS-animated squirrel character that floats on the desktop. Features: idle bobbing animation, hover tooltip with next bus info, click-to-expand detail panel, configurable location/destination/reminder, alarm with sound + shake animation, draggable window.
- `src/components/BusCard.vue` — Original web-mode bus card component (only used in web mode).
- `src/components/ScheduleTable.vue` — Table view for full schedule (web mode only).
- `electron/main.js` — Electron main process. Creates a frameless, transparent, always-on-top window. Saves/loads user config (location, destination, reminder minutes, window position) to a JSON file in Electron's `userData` directory. Exposes IPC for config and window control. Includes system tray icon support.
- `electron/preload.js` — Secure bridge exposing `electronAPI` to the renderer (contextIsolation: true).
- `public/time.json` — Raw schedule data. Uses loop notation (`"08:30-12:30"`) for repeating 5-minute buses; expanded at load time by `expandLoopBuses()` in both App.vue and DeskPet.vue.
- `src/style.css` — Tailwind imports plus base font + bus-list transitions.
- `scripts/optimize-package.js` — Post-build script that removes unnecessary locale files to reduce package size.

### Data flow

1. `App.vue` (web mode) and `DeskPet.vue` (desk pet mode) both fetch `time.json` from `/SEU-BUS/time.json`
2. `expandLoopBuses()` converts time ranges into individual bus entries with `isLoop: true`
3. Both modes operate on: `{ workday: { stopName: [...] }, holiday: { stopName: [...] } }`
4. In desk pet mode, config (location, destination, reminder) is persisted via Electron IPC to a JSON file in `app.getPath('userData')`

### Electron window behavior

- Frameless, transparent, 320×500px default size
- Always-on-top by default
- Draggable by clicking the squirrel character area
- Minimize/close buttons appear on hover (top-right corner)
- Window position persisted across restarts
- Config file location: `%APPDATA%/seu-bus-desk-pet/desk-pet-config.json` on Windows
- System tray icon with context menu (Show, Minimize to tray, Exit)
- `skipTaskbar: true` — does not appear in Windows taskbar

### Desk pet interactions

- **Idle**: 六朝松鼠角色上下浮动 + 底部名称牌呼吸感
- **Hover**: Tooltip shows next bus time and wait duration (auto-hides after 4s)
- **Click**: Expands detail panel with upcoming/past buses, alarm buttons, and settings
- **Double-click**: Toggles detail panel
- **Alarm triggers**: Squirrel shakes + red toast notification + Web Audio beep
- **Settings**: Change location, destination, and reminder lead time (1-15 min)
- **Next bus alarm button**: Shown in the expanded detail panel

### Theme & dark mode (web mode only)

Uses Tailwind `darkMode: 'class'`. Theme preference saved to `localStorage` as `theme`. System preference (`prefers-color-scheme`) is used as fallback on first load.

### Holiday detection

`getDayType()` in `src/utils/holidays.js` checks the date against a built-in calendar of Chinese public holidays and 调休 workdays (no network requests). Priority: 调休 workday list > holiday list > weekend fallback. Currently covers 2025–2026; add new years by extending `HOLIDAY_CALENDAR` in that file.

### Deployment

- **Web**: GitHub Actions workflow (`.github/workflows/main.yml`) deploys `dist/` to GitHub Pages on push to `main`. Uses pnpm 10 + Node 20. The app's `base` path is `/SEU-BUS` (set in `vite.config.js`).
- **Desktop**: `.github/workflows/release.yml` builds Windows NSIS installer on tag push (`v*`) or manual dispatch. Produces `release/东南大学接驳车桌宠 Setup 1.0.0.exe`.

### Building the desktop installer

```bash
pnpm dist
```

Produces a Windows NSIS installer in `release/`. Requires `electron-builder` to complete successfully. The package is ~100MB (Electron Chromium core is unavoidable). Post-build optimization removes 52 unused locale files to shrink the package.

### Color palette

Custom Tailwind colors: `primary` (#005a9c, #004a80, #e6f0f7), `accent-red` (#d9534f), `accent-green` (#5cb85c), `accent-orange` (#f0ad4e). The desk pet squirrel uses the same `primary` blue for its background.
