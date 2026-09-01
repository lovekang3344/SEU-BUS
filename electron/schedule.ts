/**
 * Schedule reader (Electron main process).
 *
 * Reads data/time.json (campus shuttle timetable). Mirrors the TS shape in
 * src/lib/schedule.ts: { workday: { "<loc>": [{time, destination, notes}] }, holiday: {...} }
 */

import { promises as fs } from "fs";
import path from "path";
import { app } from "electron";

export interface Departure {
  time: string;
  destination: string;
  notes: string[];
}
export type ScheduleData = Record<"workday" | "holiday", Record<string, Departure[]>>;

let cache: ScheduleData | null = null;

/** Resolve the time.json path. Dev: <project>/data/time.json. Prod: resources/data/time.json. */
function resolvePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "data", "time.json");
  }
  return path.join(app.getAppPath(), "data", "time.json");
}

export async function getSchedule(): Promise<ScheduleData> {
  if (cache) return cache;
  const file = resolvePath();
  const raw = await fs.readFile(file, "utf-8");
  cache = JSON.parse(raw) as ScheduleData;
  return cache;
}
