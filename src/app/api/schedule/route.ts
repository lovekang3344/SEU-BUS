import { NextRequest, NextResponse } from "next/server";
import { getLocations, getUpcoming, todayType, type DayType } from "@/lib/schedule-server";

export const dynamic = "force-dynamic";

/** GET /api/schedule?origin=橘园&day=workday&limit=4
 *  Returns upcoming departures + location list for the picker. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const origin = sp.get("origin") ?? "橘园";
  const dayParam = sp.get("day");
  const day: DayType = dayParam === "holiday" || dayParam === "workday" ? dayParam : todayType();
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "4") || 4, 1), 20);

  const [upcoming, locations] = await Promise.all([
    getUpcoming(origin, day, new Date(), limit),
    getLocations(day),
  ]);

  return NextResponse.json({
    ...upcoming,
    locations,
    now: new Date().toISOString(),
  });
}
