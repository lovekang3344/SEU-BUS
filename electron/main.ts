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

import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, protocol, globalShortcut } from "electron";
import path from "path";
import fs from "fs";
import { KeepAliveManager } from "./keepalive";
import { getSchedule } from "./schedule";
import { IPC, type DisplayBounds } from "./types";

// Register the app:// scheme as privileged BEFORE app.whenReady.
// This lets it support fetch, CORS, relative URLs, etc. — like https://.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const ka = new KeepAliveManager();

/** Resolve a web path like "/_next/static/x.js" or "/pets/cat.png" to an
 *  absolute filesystem path pointing into the static export (out/).
 *  Works both in dev (plain folder) and packaged (inside app.asar).
 *  Returns null if the path escapes the out/ root (directory-traversal guard). */
function resolveAppFilePath(urlPath: string): string | null {
  // Strip query/hash.
  const clean = urlPath.split(/[?#]/)[0];
  // Normalize leading slashes.
  const rel = clean.replace(/^\/+/, "");
  // The static export lives in `out/`.
  //   - Dev: <projectRoot>/out  (__dirname is dist-electron, so .. / out)
  //   - Packaged: <resourcesPath>/app.asar/out  (fs transparently reads asar)
  const isPackaged = app.isPackaged;
  const outRoot = isPackaged
    ? path.join(process.resourcesPath, "app.asar", "out")
    : path.join(__dirname, "..", "out");
  const full = path.resolve(outRoot, rel);
  // Prevent directory traversal outside out/.
  const rootResolved = path.resolve(outRoot);
  if (!full.startsWith(rootResolved)) return null;
  return full;
}

/** Map file extension → MIME type. */
const MIME_TYPES: Record<string, string> = {
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  html: "text/html",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  woff: "font/woff",
  ico: "image/x-icon",
  map: "application/json",
  txt: "text/plain",
};

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
        "default-src 'self' app: data:",
        "script-src 'self' 'unsafe-inline' app:",
        "style-src 'self' 'unsafe-inline' app:",
        "img-src 'self' data: app: blob:",
        "font-src 'self' data: app:",
        "connect-src 'self' app:",
        "worker-src 'self' blob:",
        "media-src 'self' app: data:",
      ].join("; ");
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Load the Next.js dev server (dev) or the built static export (prod).
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Use the custom app:// protocol so absolute paths like /_next/... resolve
    // to the static export inside the asar. (file:// would break them.)
    mainWindow.loadURL("app://./index.html");
  }

  // In packaged builds, F12 toggles DevTools for debugging.
  // Also log any load failures to the console so the user can see them
  // when running from a terminal.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // F12 toggles DevTools (useful for debugging packaged builds).
  globalShortcut.register("F12", () => {
    const w = mainWindow;
    if (!w) return;
    if (w.webContents.isDevToolsOpened()) {
      w.webContents.closeDevTools();
    } else {
      w.webContents.openDevTools({ mode: "detach" });
    }
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
  // Register a custom `app://` protocol that serves files from the static
  // export (out/). This is necessary because Next.js static export uses
  // absolute paths like /_next/... and /pets/... which break under file://
  // (absolute paths resolve to filesystem root). The app:// protocol lets us
  // intercept these and serve the correct file from inside the asar.
  //
  // We use fs.readFile (NOT net.fetch) because fs transparently reads from
  // app.asar — net.fetch on asar file:// URLs fails with ERR_FILE_NOT_FOUND
  // on Windows.
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    // app://./index.html  →  pathname "/index.html"
    const filePath = resolveAppFilePath(url.pathname);
    if (!filePath) {
      console.error(`[app://] path rejected (traversal?): ${url.pathname}`);
      return new Response("Not found", { status: 404 });
    }
    try {
      const buf = await fs.promises.readFile(filePath);
      const ext = url.pathname.split(".").pop()?.toLowerCase() || "";
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        },
      });
    } catch (e) {
      console.error(`[app://] readFile failed for ${filePath}:`, e);
      return new Response("Not found", { status: 404 });
    }
  });

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
