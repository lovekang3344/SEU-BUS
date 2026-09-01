"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Cat, Bus, Terminal, X } from "lucide-react";
import { usePetStore } from "@/hooks/use-pet-store";
import { attachInteractive, lockInteractive, isDesktop } from "@/lib/desktop";
import { PetPicker } from "./PetPicker";
import { SchedulePanel } from "./SchedulePanel";
import { KeepAliveToggle } from "./KeepAliveToggle";

type Panel = "picker" | "schedule" | "keepalive";

/** Tab config for the unified panel. */
const TABS: { id: Panel; label: string; icon: typeof Cat }[] = [
  { id: "picker", label: "伙伴", icon: Cat },
  { id: "schedule", label: "发车", icon: Bus },
  { id: "keepalive", label: "保活", icon: Terminal },
];

/**
 * Unified floating control panel — no persistent bottom dock.
 *
 * Visibility is driven by a global event "pet-open-panel" (dispatched from the
 * right-click context menu's "控制面板" item, or by other triggers). When open:
 *  - Panel floats at bottom-right of the screen (out of the way of work).
 *  - Top: QuickActions (pet status + 摸头/喂食/溜达/睡觉).
 *  - Middle: tab bar (伙伴 / 发车 / 保活).
 *  - Body: the selected panel's Card content.
 *  - Close button (X) top-right.
 * Auto-collapses 2.5s after the cursor leaves the panel.
 */
export function PetDock() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Panel>("picker");
  const [closingIn, setClosingIn] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for "pet-open-panel" events (from context menu / other triggers).
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setClosingIn(false);
    };
    const onClose = () => {
      setOpen(false);
      setClosingIn(false);
    };
    window.addEventListener("pet-open-panel", onOpen);
    window.addEventListener("pet-close-panel", onClose);
    return () => {
      window.removeEventListener("pet-open-panel", onOpen);
      window.removeEventListener("pet-close-panel", onClose);
    };
  }, []);

  // Register the panel as an interactive zone (click-through logic).
  useEffect(() => {
    if (!open) return;
    return attachInteractive(panelRef.current);
  }, [open]);

  // Lock window into "receive mouse" mode while the panel is open.
  useEffect(() => {
    if (!isDesktop() || !open) return;
    lockInteractive(true);
    return () => lockInteractive(false);
  }, [open]);

  // Auto-collapse: if the cursor leaves the panel for 2.5s, close it.
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const AUTO_MS = 2500;
    const arm = () => {
      if (timer) clearTimeout(timer);
      setClosingIn(true);
      timer = setTimeout(() => {
        setOpen(false);
        setClosingIn(false);
      }, AUTO_MS);
    };
    const disarm = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      setClosingIn(false);
    };
    const el = panelRef.current;
    const onEnter = () => disarm();
    const onLeave = () => arm();
    if (el) {
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
    }
    arm();
    return () => {
      if (el) {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
      }
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  if (!open) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={panelRef}
        className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-2xl overflow-visible"
      >
        {/* "about to close" countdown strip */}
        {closingIn && (
          <div className="absolute -top-1 left-2 right-2 h-0.5 rounded-full bg-zinc-300/70 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full bg-amber-500 origin-left"
              style={{ animation: "collapse-bar 2.5s linear forwards" }}
            />
          </div>
        )}

        {/* Header: title + close */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-border/40">
          <span className="text-sm font-semibold">控制面板</span>
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => { setOpen(false); setClosingIn(false); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 pt-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "ghost"}
              className="h-7 flex-1 text-xs"
              onClick={() => setTab(id)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="ml-1">{label}</span>
            </Button>
          ))}
        </div>

        {/* Body: the selected panel's Card (without their own QuickActions since
            we could embed it, but keep them as-is for now — each has QuickActions
            at top which is fine, gives per-panel context). */}
        <div className="p-2 max-h-[60vh] overflow-y-auto pet-scroll">
          {tab === "picker" && <PetPicker onClose={() => setOpen(false)} />}
          {tab === "schedule" && <SchedulePanel onClose={() => setOpen(false)} />}
          {tab === "keepalive" && <KeepAliveToggle onClose={() => setOpen(false)} />}
        </div>
      </div>
    </TooltipProvider>
  );
}