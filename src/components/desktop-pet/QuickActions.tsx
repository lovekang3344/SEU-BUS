"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Heart, Utensils, Moon, Sun, Footprints, Bell, BellOff, Power, ZoomIn } from "lucide-react";
import { usePetStore } from "@/hooks/use-pet-store";
import { getPet } from "@/lib/pets";
import { getKeepAlive, startKeepAlive, stopKeepAlive } from "@/lib/desktop";

function petAction(action: string) {
  window.dispatchEvent(new CustomEvent("pet-action", { detail: action }));
}

/** Compact row of quick pet actions + keepalive/reminder toggles.
 *  Shown at the top of any panel in the unified control panel. */
export function QuickActions() {
  const petId = usePetStore((s) => s.petId);
  const meta = getPet(petId);
  const activity = usePetStore((s) => s.activity);
  const happiness = usePetStore((s) => s.happiness);
  const energy = usePetStore((s) => s.energy);
  const remindersEnabled = usePetStore((s) => s.remindersEnabled);
  const setRemindersEnabled = usePetStore((s) => s.setRemindersEnabled);
  const reminderLeadMinutes = usePetStore((s) => s.reminderLeadMinutes);
  const scale = usePetStore((s) => s.scale);
  const setScale = usePetStore((s) => s.setScale);

  const [kaEnabled, setKaEnabled] = useState(false);
  const [kaBusy, setKaBusy] = useState(false);

  // Load keepalive state once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getKeepAlive();
        if (!cancelled) setKaEnabled(s.enabled);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleKeepAlive = useCallback(async () => {
    setKaBusy(true);
    try {
      const next = kaEnabled
        ? await stopKeepAlive()
        : await startKeepAlive(1800);
      setKaEnabled(next.enabled);
    } catch { /* ignore */ }
    setKaBusy(false);
  }, [kaEnabled]);

  const happinessPct = Math.max(0, Math.min(100, happiness));
  const energyPct = Math.max(0, Math.min(100, energy));

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 backdrop-blur px-2 py-1.5 mb-2 space-y-1.5">
      {/* Row 1: pet identity + stat bars */}
      <div className="flex items-center gap-1.5">
        <img src={meta.src} alt={meta.nameCn} className="pet-sprite h-6 w-6 shrink-0" style={{ imageRendering: "pixelated" }} />
        <div className="flex flex-col leading-tight mr-1 shrink-0">
          <span className="text-[11px] font-semibold flex items-center gap-1">
            {meta.nameCn}<span className="text-muted-foreground">{meta.emoji}</span>
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <Heart className="h-2.5 w-2.5 text-rose-500" />
              <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${happinessPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Footprints className="h-2.5 w-2.5 text-amber-500" />
              <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${energyPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-border/60 mx-0.5" />

        {/* quick pet actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => petAction("pet")}>
              <Heart className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>摸摸头</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => petAction("feed")}>
              <Utensils className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>喂食</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => petAction("walk")}>
              <Footprints className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>溜达</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => petAction(activity === "sleeping" ? "wake" : "sleep")}>
              {activity === "sleeping" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{activity === "sleeping" ? "叫醒" : "睡觉"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Row 2: quick toggles (KeepAlive + reminder) */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-border/40">
        {/* KeepAlive quick toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-pointer">
              <Power className={`h-3.5 w-3.5 ${kaEnabled ? "text-emerald-600" : "text-muted-foreground"}`} />
              <span className="text-[11px]">保活</span>
              <Switch
                checked={kaEnabled}
                disabled={kaBusy}
                onCheckedChange={toggleKeepAlive}
                className="scale-90 origin-left"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>KeepAlive {kaEnabled ? "运行中" : "已停止"}</TooltipContent>
        </Tooltip>

        {/* Reminder quick toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-pointer">
              {remindersEnabled
                ? <Bell className="h-3.5 w-3.5 text-emerald-600" />
                : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-[11px]">发车提醒</span>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={setRemindersEnabled}
                className="scale-90 origin-left"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>班车到站前 {reminderLeadMinutes} 分钟提醒</TooltipContent>
        </Tooltip>
      </div>

      {/* Row 3: zoom slider (replaces discrete click-zoom in context menu) */}
      <div className="flex items-center gap-2 pt-1.5 border-t border-border/40">
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] shrink-0">缩放</span>
        <Slider
          value={[Math.round(scale * 100)]}
          min={75}
          max={150}
          step={5}
          onValueChange={(v) => setScale(v[0] / 100)}
          className="flex-1"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  );
}