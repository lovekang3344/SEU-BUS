/**
 * Shuttle schedule — pure types & helpers (no Node.js deps).
 *
 * Safe to import from both client and server. Node-only file-reading lives
 * in `schedule-server.ts` so it never ends up in the browser bundle.
 */

export type DayType = "workday" | "holiday";

export interface Departure {
  time: string;          // "08:30"
  destination: string;   // "载体"
  notes: string[];       // ["经苏源"]
}

export type ScheduleData = Record<DayType, Record<string, Departure[]>>;

/** Determine whether today (in Asia/Shanghai) is a workday or holiday. */
export function todayType(now: Date = new Date()): DayType {
  const shanghai = new Date(now.getTime() + 8 * 3600 * 1000);
  const day = shanghai.getUTCDay();
  return day === 0 || day === 6 ? "holiday" : "workday";
}

/** Current HH:MM in Asia/Shanghai. */
export function nowHHMM(now: Date = new Date()): string {
  const shanghai = new Date(now.getTime() + 8 * 3600 * 1000);
  const hh = String(shanghai.getUTCHours()).padStart(2, "0");
  const mm = String(shanghai.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Resolve the effective day type: if override is "auto" (or undefined), use
 *  todayType(); otherwise use the manual override. */
export function effectiveDayType(
  override: "auto" | "workday" | "holiday" | undefined,
  now: Date = new Date()
): DayType {
  if (override === "workday") return "workday";
  if (override === "holiday") return "holiday";
  return todayType(now);
}

export interface UpcomingDeparture extends Departure {
  inMinutes: number;
  upcoming: boolean;
}

/** Pure: compute upcoming departures from already-loaded schedule data. */
export function computeUpcoming(
  schedule: ScheduleData,
  origin: string,
  day: DayType = todayType(),
  now: Date = new Date(),
  limit = 4
): UpcomingDeparture[] {
  const list = schedule[day]?.[origin] ?? [];
  const nowStr = nowHHMM(now);
  const nowMin = parseInt(nowStr.slice(0, 2)) * 60 + parseInt(nowStr.slice(3, 5));

  const enriched: UpcomingDeparture[] = list.map((d) => {
    const [h, m] = d.time.split(":").map(Number);
    const inMinutes = h * 60 + m - nowMin;
    return { ...d, inMinutes, upcoming: inMinutes >= 0 };
  });

  return enriched
    .filter((d) => d.upcoming)
    .sort((a, b) => a.inMinutes - b.inMinutes)
    .slice(0, limit);
}

/** Pure: locations for a day, in a stable friendly order. */
export function listLocations(schedule: ScheduleData, day: DayType = todayType()): string[] {
  const locs = Object.keys(schedule[day] ?? {});
  const preferred = ["兰园", "橘园", "无线谷", "载体", "兰台", "北门转盘", "纪忠楼"];
  const order = preferred.filter((l) => locs.includes(l));
  const rest = locs.filter((l) => !preferred.includes(l));
  return [...order, ...rest];
}
