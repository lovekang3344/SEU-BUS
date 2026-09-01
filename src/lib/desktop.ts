/**
 * Desktop environment detection + unified IPC client (Electron).
 *
 * Single source of truth for "are we running inside the Electron desktop
 * shell?". Components that need OS-level capabilities (transparent
 * click-through window, real PowerShell keep-alive, system tray) go through
 * here. In a plain browser it falls back to the HTTP APIs so the same
 * frontend works in both contexts.
 *
 * The Electron main process + preload expose `window.desktop` (see
 * electron/preload.ts and electron/types.ts).
 */

import type { ScheduleData } from "@/lib/schedule";

/* ------------------------------------------------------------------ */
/*  Types (mirror electron/types.ts)                                  */
/* ------------------------------------------------------------------ */

export interface KeepAliveState {
  enabled: boolean;
  intervalSeconds: number;
  lastToggledAt: string | null;
  lastToggledBy: string | null;
  /** True when the PowerShell child process is actually running. */
  processRunning: boolean;
  /** Last few lines of stdout from the script (ring buffer). */
  logTail: string[];
}

/** Combined bounds of all displays (for clamping the pet across monitors). */
export interface DisplayBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Shape exposed by the Electron preload via contextBridge. */
export interface DesktopApi {
  setInteractive: (interactive: boolean) => void;
  onTrayAction: (cb: (action: string) => void) => void;
  onKeepAliveUpdate: (cb: (state: KeepAliveState) => void) => void;
  keepalive: {
    get: () => Promise<KeepAliveState>;
    start: (intervalSeconds: number) => Promise<KeepAliveState>;
    stop: () => Promise<KeepAliveState>;
  };
  schedule: {
    get: () => Promise<unknown>;
  };
  getDisplayBounds: () => Promise<DisplayBounds>;
  window: {
    show: () => void;
    hide: () => void;
    quit: () => void;
  };
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

/* ------------------------------------------------------------------ */
/*  Detection                                                         */
/* ------------------------------------------------------------------ */

/** True when running inside the Electron desktop shell. */
export const isDesktop = (): boolean =>
  typeof window !== "undefined" && !!window.desktop;

function getDesktop() {
  return typeof window !== "undefined" ? window.desktop ?? null : null;
}

/* ------------------------------------------------------------------ */
/*  Window / click-through                                            */
/* ------------------------------------------------------------------ */

/** Tell the main window to enable/disable click-through. */
export async function setInteractive(interactive: boolean): Promise<void> {
  getDesktop()?.setInteractive(interactive);
}

export async function showWindow(): Promise<void> {
  getDesktop()?.window.show();
}

export async function hideWindow(): Promise<void> {
  getDesktop()?.window.hide();
}

export async function quitApp(): Promise<void> {
  getDesktop()?.window.quit();
}

/** Get the clamping bounds for the pet.
 *  - Desktop (Electron): combined bounds across ALL displays (multi-monitor).
 *  - Web: just window.innerWidth/Height.
 *  Returns {minX, minY, maxX, maxY}. */
export async function getPetBounds(): Promise<DisplayBounds> {
  const d = getDesktop();
  if (d) return d.getDisplayBounds();
  return {
    minX: 0,
    minY: 0,
    maxX: window.innerWidth,
    maxY: window.innerHeight,
  };
}

/** Listen for tray-menu actions dispatched from main. */
export function onTrayAction(cb: (action: string) => void): () => void {
  const d = getDesktop();
  if (!d) return () => {};
  d.onTrayAction(cb);
  return () => {};
}

/* ------------------------------------------------------------------ */
/*  Keep-alive (real PowerShell in desktop, mock HTTP in web)         */
/* ------------------------------------------------------------------ */

export async function getKeepAlive(): Promise<KeepAliveState> {
  const d = getDesktop();
  if (d) return d.keepalive.get();
  const r = await fetch("/api/keepalive");
  if (!r.ok) throw new Error("keepalive fetch failed");
  const j = await r.json();
  return { ...j, processRunning: false, logTail: [] };
}

export async function startKeepAlive(intervalSeconds: number): Promise<KeepAliveState> {
  const d = getDesktop();
  if (d) return d.keepalive.start(intervalSeconds);
  const r = await fetch("/api/keepalive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, intervalSeconds, by: "pet" }),
  });
  if (!r.ok) throw new Error("keepalive start failed");
  const j = await r.json();
  return { ...j, processRunning: false, logTail: [] };
}

export async function stopKeepAlive(): Promise<KeepAliveState> {
  const d = getDesktop();
  if (d) return d.keepalive.stop();
  const r = await fetch("/api/keepalive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: false, by: "pet" }),
  });
  if (!r.ok) throw new Error("keepalive stop failed");
  const j = await r.json();
  return { ...j, processRunning: false, logTail: [] };
}

/** Subscribe to keep-alive state pushes from main (log lines, process exit). */
export function onKeepAliveUpdate(cb: (state: KeepAliveState) => void): () => void {
  const d = getDesktop();
  if (!d) return () => {};
  d.onKeepAliveUpdate(cb);
  return () => {};
}

/* ------------------------------------------------------------------ */
/*  Schedule (read time.json from disk in desktop, HTTP in web)       */
/* ------------------------------------------------------------------ */

/** In desktop mode we read the whole schedule from disk via main.
 *  Returns null in web mode (the per-origin /api/schedule is used there). */
export async function fetchScheduleData(): Promise<ScheduleData | null> {
  const d = getDesktop();
  if (!d) return null;
  return d.schedule.get() as Promise<ScheduleData>;
}

/* ------------------------------------------------------------------ */
/*  Click-through helper                                              */
/* ------------------------------------------------------------------ */

// Strategy (Electron on Windows):
//   The main window starts in click-through mode with `forward: true`. This
//   means CLICK events pass through to the desktop, but MOUSEMOVE events are
//   forwarded to the renderer — so JS always knows where the cursor is.
//   We use a single document-level mousemove listener to test whether the
//   cursor is currently over any registered "interactive zone" (pet/dock/
//   panel). If yes, we flip to "receive" mode (clicks land on the window);
//   if no, we flip back to "forward" mode (clicks pass through).
//
//   This is zero-latency and zero-polling — a major improvement over the
//   Tauri approach (which has no `forward` equivalent and had to probe).
//
//   Lock: when a panel is open, `lockInteractive(true)` forces "receive"
//   mode so the panel stays fully clickable regardless of cursor position.

const interactiveZones = new Set<HTMLElement>();
let listenerInstalled = false;
let currentlyInteractive = false; // start in click-through (matches main.ts)
let interactiveLock = 0;
let lastX = -1;
let lastY = -1;

function applyInteractive(want: boolean) {
  if (interactiveLock > 0) want = true;
  if (want === currentlyInteractive) return;
  currentlyInteractive = want;
  void setInteractive(want);
}

function checkAt(x: number, y: number) {
  if (interactiveLock > 0) { applyInteractive(true); return; }
  const el = document.elementFromPoint(x, y);
  let want = false;
  if (el) {
    for (const zone of interactiveZones) {
      if (zone === el || zone.contains(el)) { want = true; break; }
    }
  }
  applyInteractive(want);
}

function ensureGlobalListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  // document-level mousemove fires continuously because of `forward: true`,
  // even while clicks pass through.
  document.addEventListener("mousemove", (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    checkAt(lastX, lastY);
  });
  // Fallback: pointermove (some platforms/GPU paths deliver pointer but not mouse).
  document.addEventListener("pointermove", (e) => {
    if (lastX < 0) { lastX = e.clientX; lastY = e.clientY; }
  });
}

/**
 * Lock the window into "receive mouse" mode. Use when a panel is open so it
 * stays fully interactive regardless of where the cursor drifts. Pair with
 * `lockInteractive(false)` when the panel closes.
 */
export function lockInteractive(locked: boolean): void {
  if (!isDesktop()) return;
  interactiveLock = Math.max(0, interactiveLock + (locked ? 1 : -1));
  applyInteractive(interactiveLock > 0);
}

/**
 * Register an element as a "click-catching" zone.
 *
 * - Cursor over this element → window receives mouse events (interactive).
 * - Cursor elsewhere → clicks pass through to the desktop (mousemove still
 *   flows back to the renderer thanks to `forward: true`).
 *
 * In a plain browser this is a no-op.
 */
export function attachInteractive(el: HTMLElement | null): () => void {
  if (!el || !isDesktop()) return () => {};
  interactiveZones.add(el);
  ensureGlobalListener();
  return () => {
    interactiveZones.delete(el);
  };
}

/**
 * Register a zone that should be "interactive" without attaching listeners.
 * Useful for portal-rendered elements (Radix ContextMenu portals) that
 * appear/disappear dynamically and are tracked elsewhere. Returns an unregister fn.
 */
export function registerInteractiveZone(el: HTMLElement): () => void {
  if (!isDesktop()) return () => {};
  interactiveZones.add(el);
  ensureGlobalListener();
  return () => {
    interactiveZones.delete(el);
  };
}

/** @returns the last known cursor client coordinates. */
export function getLastMousePosition(): { x: number; y: number } {
  return { x: lastX, y: lastY };
}