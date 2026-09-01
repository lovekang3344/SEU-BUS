/**
 * Shuttle schedule — Node-only helpers (file reading).
 *
 * Imported by the Next.js API route. Must NOT be imported from client
 * components (it uses `fs`/`path`).
 */

import { promises as fs } from "fs";
import path from "path";
import {
  computeUpcoming,
  listLocations,
  todayType,
  type ScheduleData,
  type DayType,
  type UpcomingDeparture,
} from "./schedule";

// Re-export pure helpers & types so callers can import from a single module.
export {
  todayType,
  nowHHMM,
  computeUpcoming,
  listLocations,
  type ScheduleData,
  type DayType,
  type Departure,
  type UpcomingDeparture,
} from "./schedule";

let cache: ScheduleData | null = null;

/** Read & cache data/time.json. */
export async function getSchedule(): Promise<ScheduleData> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "time.json");
  const raw = await fs.readFile(file, "utf-8");
  cache = JSON.parse(raw) as ScheduleData;
  return cache;
}

/** Get the next N departures from `origin` after the current time. */
export async function getUpcoming(
  origin: string,
  day: DayType = todayType(),
  now: Date = new Date(),
  limit = 4
): Promise<{ day: DayType; origin: string; departures: UpcomingDeparture[] }> {
  const schedule = await getSchedule();
  return { day, origin, departures: computeUpcoming(schedule, origin, day, now, limit) };
}

/** Get all origin locations for a day type. */
export async function getLocations(day: DayType = todayType()): Promise<string[]> {
  const schedule = await getSchedule();
  return listLocations(schedule, day);
}
