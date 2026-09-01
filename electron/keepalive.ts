/**
 * keepAlive.ps1 process manager (Electron main process).
 *
 * Spawns the PowerShell script that simulates a ScrollLock keypress every N
 * seconds to keep the aTrust VPN alive on Windows. Uses Node's child_process
 * (no extra deps). A background reader pipes stdout/stderr into a ring buffer
 * and pushes state updates to the renderer via the BrowserWindow webContents.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import { app, BrowserWindow } from "electron";
import { IPC, type KeepAliveState } from "./types";

const LOG_MAX = 50;

export class KeepAliveManager {
  private proc: ChildProcess | null = null;
  private intervalSeconds = 1800;
  private enabled = false;
  private lastToggledAt: string | null = null;
  private lastToggledBy: string | null = null;
  private log: string[] = [];
  private emitter = new EventEmitter();

  /** Subscribe to state updates (called by main when a renderer registers). */
  on(event: "update", cb: (s: KeepAliveState) => void): () => void {
    this.emitter.on("update", cb);
    return () => this.emitter.off("update", cb);
  }

  getState(): KeepAliveState {
    return {
      enabled: this.enabled,
      intervalSeconds: this.intervalSeconds,
      lastToggledAt: this.lastToggledAt,
      lastToggledBy: this.lastToggledBy,
      processRunning: !!this.proc,
      logTail: this.log.slice(-12),
    };
  }

  private pushLog(line: string) {
    this.log.push(line);
    if (this.log.length > LOG_MAX) {
      this.log.splice(0, this.log.length - LOG_MAX);
    }
  }

  private emit() {
    this.emitter.emit("update", this.getState());
  }

  /** Resolve the keepAlive.ps1 path.
   *  - Dev: <projectRoot>/data/keepAlive.ps1
   *  - Prod (packaged): process.resourcesPath/data/keepAlive.ps1 */
  private resolveScript(): string {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
      return path.join(process.resourcesPath, "data", "keepAlive.ps1");
    }
    // Dev: project root is the parent of the electron/ folder.
    return path.join(app.getAppPath(), "data", "keepAlive.ps1");
  }

  /** Kill any existing child, then spawn a new powershell running keepAlive.ps1. */
  start(intervalSeconds: number, by: string, win: BrowserWindow): KeepAliveState {
    // Kill previous if any.
    this.stopInternal(by, false);

    const script = this.resolveScript();
    const fs = require("fs") as typeof import("fs");
    if (!fs.existsSync(script)) {
      const msg = `keepAlive.ps1 not found at ${script}`;
      this.pushLog(`[error] ${msg}`);
      this.emit();
      win.webContents.send(IPC.KA_UPDATE, this.getState());
      throw new Error(msg);
    }

    // powershell.exe -NoProfile -ExecutionPolicy Bypass -File keepAlive.ps1 -IntervalSeconds N
    const proc = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-IntervalSeconds",
        String(intervalSeconds),
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );

    this.proc = proc;
    this.enabled = true;
    this.intervalSeconds = intervalSeconds;
    this.lastToggledAt = new Date().toISOString();
    this.lastToggledBy = by;

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) this.pushLog(line);
      }
      this.emit();
      win.webContents.send(IPC.KA_UPDATE, this.getState());
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) this.pushLog(`[stderr] ${line}`);
      }
      this.emit();
      win.webContents.send(IPC.KA_UPDATE, this.getState());
    });
    proc.on("exit", (code) => {
      this.pushLog(`[keepalive] process exited (code=${code})`);
      this.proc = null;
      this.enabled = false;
      this.emit();
      win.webContents.send(IPC.KA_UPDATE, this.getState());
    });

    this.pushLog(`[${new Date().toISOString()}] KeepAlive started, interval=${intervalSeconds}s`);
    this.emit();
    win.webContents.send(IPC.KA_UPDATE, this.getState());
    return this.getState();
  }

  stopInternal(by: string, notify: boolean) {
    if (this.proc) {
      try { this.proc.kill(); } catch { /* ignore */ }
      this.proc = null;
    }
    this.enabled = false;
    this.lastToggledAt = new Date().toISOString();
    this.lastToggledBy = by;
    this.pushLog(`[${new Date().toISOString()}] KeepAlive stopped`);
    if (notify) this.emit();
  }

  stop(by: string, win: BrowserWindow): KeepAliveState {
    this.stopInternal(by, true);
    win.webContents.send(IPC.KA_UPDATE, this.getState());
    return this.getState();
  }

  /** Called on app shutdown to clean up the child process. */
  cleanup() {
    if (this.proc) {
      try { this.proc.kill(); } catch { /* ignore */ }
      this.proc = null;
    }
  }
}
