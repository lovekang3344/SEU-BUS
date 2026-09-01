/**
 * Shared IPC channel names + payload types.
 *
 * Plain TS (no Node/Electron deps) so both the main process and the
 * preload script can import it. The renderer imports the *client* wrapper
 * at src/lib/desktop.ts.
 */

export const IPC = {
  // click-through
  SET_INTERACTIVE: "set-interactive",
  // window
  WIN_SHOW: "win-show",
  WIN_HIDE: "win-hide",
  WIN_QUIT: "win-quit",
  // tray
  TRAY_ACTION: "tray-action",
  // keep-alive
  KA_GET: "ka-get",
  KA_START: "ka-start",
  KA_STOP: "ka-stop",
  KA_UPDATE: "ka-update",
  // schedule (read time.json from disk)
  SCHED_GET: "sched-get",
  // display info (multi-monitor bounds)
  DISPLAY_BOUNDS: "display-bounds",
} as const;

/** Combined bounds of all displays (for clamping the pet across monitors). */
export interface DisplayBounds {
  /** Leftmost edge across all displays (can be negative if a display is to the left). */
  minX: number;
  /** Topmost edge across all displays. */
  minY: number;
  /** Rightmost edge (minX + total width). */
  maxX: number;
  /** Bottommost edge (minY + total height). */
  maxY: number;
}

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

/** Shape of the API exposed to the renderer via contextBridge. */
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
    get: () => Promise<unknown>; // ScheduleData; typed loosely to avoid coupling
  };
  /** Combined bounds of all displays (for clamping the pet across monitors). */
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
