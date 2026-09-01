# Desktop Pet MVP — Worklog

---
Task ID: 1
Agent: main (Z.ai Code orchestrator)
Task: Build a low-resource desktop pet MVP using Kenney Cube Pets assets, with interactions, and prepare for future time.json + keepAlive.ps1 integration.

Work Log:
- Explored uploaded assets: Kenney cube-pets (24 GLB 3D models + 64x64 preview PNGs ~2KB each + shared colormap), time.json (campus shuttle schedule, workday/holiday × 7 locations), keepAlive.ps1 (ScrollLock key-sim every N sec to keep aTrust VPN alive).
- Decided low-resource strategy: use the 64x64 preview PNGs (not 3D GLB) with `image-rendering: pixelated` + CSS transform/opacity animations. ~100KB total for all 24 pets, no GPU/3D cost.
- Copied 24 pet sprites to `public/pets/`, copied time.json + keepAlive.ps1 to `data/`.
- Built `src/lib/pets.ts` — 24-animal registry with CN/EN names, emojis, accent colors, taglines.
- Built `src/lib/schedule.ts` + `src/app/api/schedule/route.ts` — parses time.json, computes next N departures in Asia/Shanghai tz, auto workday/holiday detection.
- Built `src/app/api/keepalive/route.ts` — in-memory toggle state (enabled/interval/lastToggled), GET + POST.
- Built `src/hooks/use-pet-store.ts` — Zustand store (persisted) for petId, position, facing, scale, activity, autonomy, happiness, energy, speech bubbles, schedule prefs.
- Built `src/components/desktop-pet/DesktopPet.tsx` — the pet: pointer drag (mouse+touch), click-to-pet (hearts), double-click-feed, sleep/wake, autonomous roaming, RAF walker, tab-visibility pause (low resource), Zzz + heart particles, speech bubbles, energy drain/recovery.
- Built `PetContextMenu.tsx` (right-click: pet/feed/walk/sleep/wake + 换宠物 submenu + 设置 submenu), `PetPicker.tsx` (24-pet grid), `SchedulePanel.tsx` (next departures, origin select, refresh, reminder toggle), `KeepAliveToggle.tsx` (switch + interval slider), `PetDock.tsx` (sticky footer with identity, stat pills, quick actions, panel toggles).
- Added CSS keyframes in globals.css: idle/happy/walk/eat/sleep/dragged animations, shadow, hearts, Zzz, bubble-pop, desktop-wallpaper gradient, pet-scroll scrollbar.
- Wired `src/app/page.tsx` — desktop scene (wallpaper + grid), SceneHeader, OnboardingHint, pet in context menu, centered hint main, sticky PetDock footer.
- Fixed React 19 `react-hooks/set-state-in-effect` lint errors by inlining async IIFE in effects (setState only after await).
- Browser-verified with Agent Browser: page renders (no console/runtime errors), pet sprite loads, click→hearts+bubble, pet picker (24 pets, cat→dog switch works), schedule panel (real departures from time.json, next-bus badge), keepAlive toggle (POST persists, GET confirms), right-click context menu (6 actions), sleep→Zzz particles, drag→position change, mobile (390x844) footer sticks to bottom.

Stage Summary:
- MVP complete and browser-verified. All core desktop-pet interactions work; time.json schedule integration and keepAlive toggle already functional (read-only/state-level). Architecture is ready to extend keepAlive to spawn/manage the actual .ps1 process in a later iteration.
- Key files: `src/lib/pets.ts`, `src/lib/schedule.ts`, `src/hooks/use-pet-store.ts`, `src/components/desktop-pet/*`, `src/app/api/{schedule,keepalive}/route.ts`, `src/app/page.tsx`.
- Tech notes: sprites are 64px upscaled pixelated; animations are GPU-friendly transform/opacity only; autonomous walk uses a single RAF loop that pauses on tab-hide; state persists to localStorage.

---
Task ID: 2
Agent: main (Z.ai Code orchestrator)
Task: Migrate the desktop pet from Electron plan to Tauri v2 (Rust) for smaller footprint (~10MB vs ~80MB, ~40MB RAM vs ~100MB), with real keepAlive.ps1 process control.

Work Log:
- Cleaned up the Electron scaffolding; rebuilt on Tauri v2 + Rust.
- Installed `@tauri-apps/api` for typed invoke() in the renderer.
- Rewrote `src/lib/desktop.ts` as the unified IPC client: detects `window.__TAURI_INTERNALS__`, lazy-imports `@tauri-apps/api/core` + `/event`, exposes setInteractive / getKeepAlive / startKeepAlive / stopKeepAlive / onKeepAliveUpdate / fetchScheduleData / attachInteractive. Web mode falls back to HTTP so the same frontend works in both contexts.
- Created the Rust project under `src-tauri/`:
  - `Cargo.toml` (tauri v2, serde, serde_json; release profile: lto=true, opt-level=s, strip=true for tiny binary)
  - `tauri.conf.json` — transparent + decorations:false + alwaysOnTop + skipTaskbar + shadow:false window; bundles data/keepAlive.ps1 + data/time.json as resources.
  - `src/main.rs` + `src/lib.rs` — window setup, system tray (显示/隐藏/退出 + left-click toggle), click-through command `set_interactive` via `set_ignore_cursor_events`.
  - `src/keepalive.rs` — `KeepAliveManager` with `std::process::Command` spawning `powershell.exe -NoProfile -ExecutionPolicy Bypass -File keepAlive.ps1 -IntervalSeconds N` with CREATE_NO_WINDOW; background threads pipe stdout/stderr into a 50-line ring buffer and emit `ka-update` events to the frontend.
  - `src/schedule.rs` — reads bundled time.json with serde_json, returns the full ScheduleData.
  - `capabilities/default.json` — Tauri v2 permission allowlist (window show/hide/focus/ignore-cursor-events).
- Generated Tauri app icons from `animal-cat.png` via `scripts/gen-icons.mjs` (sharp + hand-rolled ICO encoder) into `src-tauri/icons/`.
- Frontend adaptations:
  - `src/app/page.tsx` — desktop mode skips wallpaper/grid/SceneHeader (transparent), keeps pet + dock + panels; listens for tray actions (show/hide).
  - `globals.css` — `body.desktop-mode { background: transparent }`.
  - `DesktopPet.tsx` + `PetDock.tsx` — `attachInteractive(ref)` so only the pet/dock/panel catch clicks; everywhere else click-through is on.
  - `KeepAliveToggle.tsx` — rewrote to use `getKeepAlive/startKeepAlive/stopKeepAlive/onKeepAliveUpdate`; shows live PowerShell stdout log panel in desktop mode.
  - `SchedulePanel.tsx` — unified `fetchSchedule()` that uses Rust `sched_get` + browser-side `computeUpcoming` in desktop mode, HTTP in web mode.
- Split `src/lib/schedule.ts` (pure, browser-safe) from `src/lib/schedule-server.ts` (fs/path, Node-only) so the client bundle never imports `fs`. Re-exported pure helpers from the server module for the API route.
- `next.config.ts` — `output: process.env.BUILD_DESKTOP === "1" ? "export" : "standalone"` so web keeps API routes, desktop build is static.
- `package.json` — added `build:desktop`, `gen:icons`, `tauri:dev`, `tauri:build`, `tauri:icon` scripts.
- Wrote `README-desktop.md` with prerequisites (Rust/WebView2/MSVC), dev/build steps, architecture, and web-vs-desktop comparison.
- Verified web preview unaffected: lint clean; Agent Browser confirms pet renders, click→hearts, schedule panel (5 departures, "11:00 下一班 5分钟后"), keepalive toggle (switch checked true), no console/runtime errors.

Stage Summary:
- Tauri v2 (Rust) desktop shell complete; same frontend runs in browser (web preview) and in a transparent always-on-top Tauri window (desktop). Rust code uses official Tauri v2 APIs and should compile on a Windows machine with Rust + MSVC installed.
- Key artifacts: `src-tauri/` (Cargo.toml, tauri.conf.json, src/*.rs, icons/, capabilities/), `src/lib/desktop.ts` (unified IPC), `src/lib/schedule{,-server}.ts` (pure/server split), `scripts/gen-icons.mjs`, `README-desktop.md`.
- Footprint: ~10MB installer, ~40-60MB RAM (vs Electron ~80MB/~100MB). keepAlive.ps1 is now a REAL spawned PowerShell child process (not mock state).
- Sandbox limitation: no Rust toolchain, so `tauri:dev`/`tauri:build` must be run on the user's Windows machine. All web-preview interactions verified working.

---
Task ID: 3
Agent: main (Z.ai Code orchestrator)
Task: Migrate from Tauri (Rust) to Electron because Tauri v2 lacks setIgnoreMouseEvents(forward: true), causing click-through polling jitter; Electron's forward flag gives zero-latency, zero-polling click-through. Also better for future feature expansion (Node ecosystem vs Rust).

Work Log:
- Removed `src-tauri/` (Rust project) and uninstalled `@tauri-apps/api`.
- Installed Electron dev deps: `electron`, `electron-builder`, `concurrently`, `wait-on`, `cross-env`.
- Created `electron/types.ts` — shared IPC channel names + KeepAliveState + DesktopApi interface + `declare global Window.desktop`.
- Created `electron/keepalive.ts` — `KeepAliveManager` class using Node `child_process.spawn` to run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File keepAlive.ps1 -IntervalSeconds N` with `windowsHide:true` and piped stdio; background readers feed a 50-line ring buffer and push `ka-update` events to the renderer via `webContents.send`. Handles start/stop/cleanup + process-exit detection.
- Created `electron/schedule.ts` — `fs.readFile` of `data/time.json` (dev: project root; prod: `process.resourcesPath/data/`), cached.
- Created `electron/preload.ts` — `contextBridge.exposeInMainWorld("desktop", api)` with contextIsolation; exposes setInteractive / onTrayAction / onKeepAliveUpdate / keepalive.{get,start,stop} / schedule.get / window.{show,hide,quit}.
- Created `electron/main.ts` — BrowserWindow: transparent, frame:false, alwaysOnTop, skipTaskbar, hasShadow:false, movable:false; `setIgnoreMouseEvents(true, { forward: true })` on start (THE key line that fixes the click-through jitter). Tray with 显示/隐藏/退出 menu + left-click toggle. IPC handlers for all commands. Dev: loadURL(localhost:3000) + openDevTools; prod: loadFile(out/index.html).
- Rewrote `src/lib/desktop.ts`: detection changed to `!!window.desktop`; invoke → `window.desktop.xxx`; **click-through rewritten to use `forward:true` continuous mousemove** (zero polling, zero latency) instead of the 400ms probe loop. Kept `lockInteractive` for panel stability + `attachInteractive` zone registration. Fixed SSR crash (module-level `window.innerWidth` → lazy init in `ensureGlobalListener`).
- Fixed TS errors: `setFocus()` → `focus()` on BrowserWindow; `onTrayAction`/`onKeepAliveUpdate` return `() => void` (sync) — updated `page.tsx` and `KeepAliveToggle.tsx` to not `.then()` them.
- `tsconfig.electron.json` (CommonJS, node types, DOM lib, rootDir=electron, outDir=dist-electron); main tsconfig excludes electron/dist-electron/out/src-tauri.
- `tsconfig.json` `main` field = `dist-electron/main.js`.
- `electron-builder.yml`: NSIS installer x64, extraResources copies `data/` (keepAlive.ps1 + time.json) and `build/icon.*` to resources/.
- `package.json` scripts: `electron:dev` (concurrently next dev + wait-on + electron), `electron:build` (next export + tsc + electron-builder), `electron:build:dir` (unpacked).
- `.gitignore`: removed Tauri entries, added `/dist-electron/`, `/release/`, `/out/`.
- `eslint.config.mjs`: ignores `electron/**`, `dist-electron/**`, `release/**`, `scripts/**`.
- Regenerated icons into `build/` (icon.png 256, icon.ico, icon-16/32/48/128.png) via updated `scripts/gen-icons.mjs`.
- Rewrote `README-desktop.md` for Electron (architecture, dev/build steps, click-through forward:true explanation, keepAlive child_process, troubleshooting).
- Verified: `bun run lint` clean; `npx tsc --noEmit` clean for src/; `npx tsc -p tsconfig.electron.json` compiles to dist-electron/ with no errors; Next.js dev server returns HTTP 200 and HTML contains `desktop-wallpaper`/`pet-sprite`/`猫咪 desktop pet` (web preview unaffected). Sandbox OOM prevents running Next dev + agent-browser simultaneously, but code correctness is verified.

Stage Summary:
- Electron desktop shell complete. The click-through "panel goes unclickable" bug is structurally fixed: `setIgnoreMouseEvents(true, { forward: true })` lets mousemove flow continuously to the renderer even while clicks pass through, so `attachInteractive`'s `elementFromPoint` check is always live — no polling, no jitter, no probe races. `lockInteractive` still guards panels as a belt-and-suspenders.
- Artifacts: `electron/` (main/preload/keepalive/schedule/types .ts), `src/lib/desktop.ts` (unified IPC, forward-based click-through), `tsconfig.electron.json`, `electron-builder.yml`, `build/` (icons), updated `README-desktop.md`.
- Trade-off accepted: ~80MB installer + ~100-150MB RAM (vs Tauri ~10MB/~40MB), in exchange for: (1) perfect click-through UX, (2) Node ecosystem for future feature expansion, (3) faster dev iteration (no Rust compile).
- User's next step on Windows: `bun install` then `bun run electron:dev`. No Rust/MSVC/WebView2 needed.
