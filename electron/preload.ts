/**
 * Preload script — secure bridge between the renderer and the main process.
 *
 * Uses contextBridge to expose a minimal, typed API as `window.desktop`.
 * The renderer NEVER touches Node/Electron APIs directly. This is the
 * Electron-recommended security pattern (contextIsolation: true).
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC, type DesktopApi, type KeepAliveState } from "./types";

const api: DesktopApi = {
  setInteractive: (interactive: boolean) =>
    ipcRenderer.send(IPC.SET_INTERACTIVE, interactive),

  onTrayAction: (cb) => {
    const handler = (_e: unknown, action: string) => cb(action);
    ipcRenderer.on(IPC.TRAY_ACTION, handler);
  },

  onKeepAliveUpdate: (cb) => {
    const handler = (_e: unknown, state: KeepAliveState) => cb(state);
    ipcRenderer.on(IPC.KA_UPDATE, handler);
  },

  keepalive: {
    get: () => ipcRenderer.invoke(IPC.KA_GET),
    start: (intervalSeconds: number) =>
      ipcRenderer.invoke(IPC.KA_START, intervalSeconds),
    stop: () => ipcRenderer.invoke(IPC.KA_STOP),
  },

  schedule: {
    get: () => ipcRenderer.invoke(IPC.SCHED_GET),
  },

  getDisplayBounds: () => ipcRenderer.invoke(IPC.DISPLAY_BOUNDS),

  window: {
    show: () => ipcRenderer.send(IPC.WIN_SHOW),
    hide: () => ipcRenderer.send(IPC.WIN_HIDE),
    quit: () => ipcRenderer.send(IPC.WIN_QUIT),
  },
};

contextBridge.exposeInMainWorld("desktop", api);