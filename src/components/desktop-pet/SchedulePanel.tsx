"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bus, Clock, MapPin, RefreshCw, Bell, BellOff, CalendarDays } from "lucide-react";
import { usePetStore } from "@/hooks/use-pet-store";
import { isDesktop, fetchScheduleData } from "@/lib/desktop";
import { computeUpcoming, listLocations, effectiveDayType, type ScheduleData, type DayType, type UpcomingDeparture } from "@/lib/schedule";
import { playChime } from "@/lib/sound";
import { QuickActions } from "./QuickActions";

interface ScheduleResp {
  day: DayType;
  origin: string;
  departures: UpcomingDeparture[];
  locations: string[];
  now: string;
}

/** Unified schedule fetcher: desktop reads time.json via Rust + computes in
 *  the browser; web hits /api/schedule. Uses the user's day-type override. */
async function fetchSchedule(origin: string, limit: number, dayOverride: "auto" | "workday" | "holiday"): Promise<ScheduleResp> {
  if (isDesktop()) {
    const data: ScheduleData | null = await fetchScheduleData();
    if (!data) throw new Error("schedule unavailable");
    const day = effectiveDayType(dayOverride);
    return {
      day,
      origin,
      departures: computeUpcoming(data, origin, day, new Date(), limit),
      locations: listLocations(data, day),
      now: new Date().toISOString(),
    };
  }
  // Web: pass day override as query param; API defaults to auto if not given.
  const dayParam = dayOverride === "auto" ? "" : `&day=${dayOverride}`;
  const res = await fetch(`/api/schedule?origin=${encodeURIComponent(origin)}&limit=${limit}${dayParam}`);
  if (!res.ok) throw new Error("schedule fetch failed");
  return res.json();
}

function dayLabel(day: string) {
  return day === "workday" ? "工作日" : "节假日";
}

function relTime(min: number) {
  if (min < 1) return "即将发车";
  if (min < 60) return `${min} 分钟后`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分后` : `${h} 小时后`;
}

export function SchedulePanel({ onClose }: { onClose?: () => void }) {
  const origin = usePetStore((s) => s.scheduleOrigin);
  const setOrigin = usePetStore((s) => s.setScheduleOrigin);
  const remindersEnabled = usePetStore((s) => s.remindersEnabled);
  const setRemindersEnabled = usePetStore((s) => s.setRemindersEnabled);
  const reminderLeadMinutes = usePetStore((s) => s.reminderLeadMinutes);
  const setReminderLeadMinutes = usePetStore((s) => s.setReminderLeadMinutes);
  const dayTypeOverride = usePetStore((s) => s.dayTypeOverride);
  const setDayTypeOverride = usePetStore((s) => s.setDayTypeOverride);
  const say = usePetStore((s) => s.say);

  const [data, setData] = useState<ScheduleResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const remindedKeyRef = useRef<string | null>(null);

  // initial load + on origin/day-type change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchSchedule(origin, 5, dayTypeOverride);
        if (!cancelled) setData(r);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [origin, dayTypeOverride]);

  const reload = useCallback(async () => {
    try {
      const r = await fetchSchedule(origin, 5, dayTypeOverride);
      setData(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, [origin, dayTypeOverride]);

  // periodic refresh (30s) + clock (1s)
  useEffect(() => {
    const iv30 = setInterval(reload, 30000);
    const iv1 = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv30); clearInterval(iv1); };
  }, [reload]);

  // reminder: if next departure within reminderLeadMinutes, pet announces once
  // with a speech bubble + a chime sound.
  useEffect(() => {
    if (!remindersEnabled || !data?.departures.length) return;
    const next = data.departures[0];
    if (next.inMinutes <= reminderLeadMinutes && next.inMinutes >= 0) {
      const key = `${data.origin}-${next.time}-${reminderLeadMinutes}`;
      if (key !== remindedKeyRef.current) {
        remindedKeyRef.current = key;
        say(`${data.origin} → ${next.destination} 的车 ${next.time} 就要发车啦！🚌`, "reminder", 6000);
        playChime();
      }
    }
  }, [data, remindersEnabled, reminderLeadMinutes, say]);

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bus className="h-4 w-4 text-emerald-600" />
            发车时刻表
          </CardTitle>
          {/* Day-type selector: auto / 工作日 / 节假日 */}
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={dayTypeOverride} onValueChange={(v) => setDayTypeOverride(v as "auto" | "workday" | "holiday")}>
              <SelectTrigger className="h-7 w-[88px] text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动</SelectItem>
                <SelectItem value="workday">工作日</SelectItem>
                <SelectItem value="holiday">节假日</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono pt-1">
          {now.toLocaleTimeString("zh-CN", { hour12: false })}
          {dayTypeOverride !== "auto" && <span className="ml-1 text-[10px] text-amber-600">· 手动</span>}
          {isDesktop() && <span className="ml-2 text-[10px] text-emerald-600">· 本地</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <QuickActions />
        {/* origin picker */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(data?.locations ?? ["橘园", "兰园", "无线谷", "载体", "兰台"]).map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setLoading(true); reload(); }} title="刷新">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* departures list */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pet-scroll pr-1">
          {loading && !data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : data && data.departures.length > 0 ? (
            data.departures.map((d, i) => (
              <div
                key={d.time + d.destination + i}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  i === 0 ? "border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-border/50"
                }`}
              >
                <div className="flex flex-col items-center justify-center min-w-[3rem]">
                  <span className="text-base font-bold font-mono leading-none">{d.time}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{relTime(d.inMinutes)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">→ {d.destination}</span>
                    {i === 0 && <Badge className="text-[10px] h-4 px-1 py-0 bg-emerald-600">下一班</Badge>}
                  </div>
                  {d.notes.length > 0 && (
                    <div className="text-[11px] text-muted-foreground truncate">{d.notes.join("、")}</div>
                  )}
                </div>
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Bus className="h-6 w-6 mx-auto mb-2 opacity-40" />
              今天没有更多班次了
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t flex-wrap">
          <Button
            size="sm"
            variant={remindersEnabled ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setRemindersEnabled(!remindersEnabled)}
          >
            {remindersEnabled ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
            发车提醒
          </Button>
          {remindersEnabled && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">提前</span>
              <Select value={String(reminderLeadMinutes)} onValueChange={(v) => setReminderLeadMinutes(Number(v))}>
                <SelectTrigger className="h-7 w-[60px] text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15, 20, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} 分钟</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground">提醒</span>
            </div>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
              收起
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          {remindersEnabled
            ? `🔔 下一班发车前 ${reminderLeadMinutes} 分钟内，宠物会语音+提示音提醒一次。需打开控制面板才会检测。`
            : "发车提醒已关闭。"}
          {dayTypeOverride === "auto" ? " 日期按周末自动判断。" : " 日期已手动指定。"}
        </p>
      </CardContent>
    </Card>
  );
}
