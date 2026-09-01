/**
 * Cube Pet Desktop — Electron main process.
 *
 * Window strategy: one transparent, frameless, always-on-top, skip-taskbar
 * window covering the whole screen. Click-through uses Electron's
 * `setIgnoreMouseEvents(ignore, { forward: true })` — the `forward` flag lets
 * mouse MOVE events pass through to the renderer even while clicks pass
 * through to the desktop. This is the key advantage over Tauri: the renderer
 * always knows where the cursor is, so it can flip click-through on/off with
 * zero latency and zero polling.
 *
 * The renderer calls `setInteractive(true/false)` via the preload bridge to
 * toggle click-through based on whether the cursor is over an interactive
 * zone (pet / dock / panel).
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } from "electron";
import path from "path";
import { KeepAliveManager } from "./keepalive";
import { getSchedule } from "./schedule";
import { IPC, type DisplayBounds } from "./types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const ka = new KeepAliveManager();

/** Compute the combined bounds of all displays so the transparent window
 *  spans every monitor (the pet can then be dragged across screens). */
function getAllDisplaysBounds(): DisplayBounds {
  const displays = screen.getAllDisplays();
  if (displays.length === 0) {
    const b = screen.getPrimaryDisplay().bounds;
    return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  return { minX, minY, maxX, maxY };
}

function createWindow() {
  const bounds = getAllDisplaysBounds();
  mainWindow = new BrowserWindow({
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    x: bounds.minX,
    y: bounds.minY,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Start in click-through mode with forwarding. The renderer will flip
  // to interactive=true as soon as the cursor enters an interactive zone.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Set a CSP that's strict in prod but allows Next.js dev tooling (eval,
  // ws, inline styles) in dev. This silences the "Insecure Content-Security-
  // Policy" Electron warning without breaking HMR.
  const isDev = !app.isPackaged;
  const csp = isDev
    ? [
        "default-src 'self' http://localhost:3000 ws://localhost:3000",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000",
        "style-src 'self' 'unsafe-inline' http://localhost:3000",
        "img-src 'self' data: http://localhost:3000",
        "connect-src 'self' http://localhost:3000 ws://localhost:3000",
      ].join("; ")
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
      ].join("; ");
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Load the Next.js app. In dev, connect to the dev server. In production,
  // start the bundled standalone server from .next/standalone/ and connect.
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const { spawn } = await import("node:child_process");
    const { serverPath } = await import("node:path");
    const serverFile = serverPath.join(__dirname, "..", ".next", "standalone", "server.js");
    const server = spawn(process.execPath, [serverFile], {
      cwd: serverPath.join(__dirname, "..", ".next", "standalone"),
      env: { ...process.env, PORT: "3456", HOSTNAME: "127.0.0.1" },
      stdio: "ignore",
    });
    server.on("error", () => {
      // If the bundled server fails to start, try loading the static export
      // as a fallback.
      mainWindow.loadFile(serverPath.join(__dirname, "..", "out", "index.html"));
    });
    // Wait for the server to be ready, then load the app.
    import("node:http").then(({ default: http }) => {
      const check = () =>
        http.get("http://127.0.0.1:3456", () => {
          mainWindow?.loadURL("http://127.0.0.1:3456");
        }).on("error", () => setTimeout(check, 200));
      check();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use a small PNG icon. In dev it's at build/icon.png; in prod it's bundled.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "build", "icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // Fallback: a 1x1 transparent image (tray will show default).
    icon = nativeImage.createEmpty();
  }
  // Resize for tray (16x16 on Windows is standard).
  icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("Cube Pet 桌面宠物");

  const menu = Menu.buildFromTemplate([
    { label: "显示宠物", click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send(IPC.TRAY_ACTION, "show"); } },
    { label: "隐藏宠物", click: () => { mainWindow?.hide(); mainWindow?.webContents.send(IPC.TRAY_ACTION, "hide"); } },
    { type: "separator" },
    { label: "退出", click: () => { ka.cleanup(); app.quit(); } },
  ]);
  tray.setContextMenu(menu);

  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/* ------------------------- IPC handlers ------------------------- */

function registerIpc() {
  // Click-through toggle from the renderer.
  ipcMain.on(IPC.SET_INTERACTIVE, (_e, interactive: boolean) => {
    if (!mainWindow) return;
    // interactive=true  -> ignore=false (receive clicks)
    // interactive=false -> ignore=true  with forward so mousemove still flows
    mainWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  });

  ipcMain.on(IPC.WIN_SHOW, () => mainWindow?.show());
  ipcMain.on(IPC.WIN_HIDE, () => mainWindow?.hide());
  ipcMain.on(IPC.WIN_QUIT, () => { ka.cleanup(); app.quit(); });

  ipcMain.handle(IPC.KA_GET, () => ka.getState());
  ipcMain.handle(IPC.KA_START, (_e, intervalSeconds: number) => {
    if (!mainWindow) throw new Error("no window");
    return ka.start(intervalSeconds, "pet", mainWindow);
  });
  ipcMain.handle(IPC.KA_STOP, () => {
    if (!mainWindow) throw new Error("no window");
    return ka.stop("pet", mainWindow);
  });

  ipcMain.handle(IPC.SCHED_GET, async () => {
    return await getSchedule();
  });

  // Combined bounds of all displays — the renderer uses this to clamp the pet
  // across multi-monitor setups (window.innerWidth only covers one screen).
  ipcMain.handle(IPC.DISPLAY_BOUNDS, () => getAllDisplaysBounds());

  // Re-span the window when displays change (hot-plug, resolution change).
  screen.on("display-added", () => repositionWindow());
  screen.on("display-removed", () => repositionWindow());
  screen.on("display-metrics-changed", () => repositionWindow());
}

/** Resize + reposition the window to cover all displays again. */
function repositionWindow() {
  if (!mainWindow) return;
  const b = getAllDisplaysBounds();
  try {
    mainWindow.setBounds({
      x: b.minX,
      y: b.minY,
      width: b.maxX - b.minX,
      height: b.maxY - b.minY,
    });
  } catch {
    /* setBounds can throw during transitions; ignore */
  }
}

/* ------------------------- App lifecycle ------------------------- */

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIpc();
});

app.on("window-all-closed", () => {
  // On all platforms, quit when the window is closed.
  ka.cleanup();
  app.quit();
});

app.on("before-quit", () => {
  ka.cleanup();
});