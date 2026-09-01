"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DesktopPet } from "@/components/desktop-pet/DesktopPet";
import { PetContextMenu } from "@/components/desktop-pet/PetContextMenu";
import { PetDock } from "@/components/desktop-pet/PetDock";
import { usePetStore } from "@/hooks/use-pet-store";
import { getPet } from "@/lib/pets";
import { onTrayAction, showWindow, hideWindow } from "@/lib/desktop";
import { Sparkles, MousePointerClick, Hand } from "lucide-react";

/**
 * Detect desktop mode in an SSR-safe way.
 * - Server render: returns false (no window).
 * - First client render (hydration): returns false too (must match SSR).
 * - After mount: subscribes to an external store that reads window.desktop.
 *
 * useSyncExternalStore is the React 18+ blessed way to read external state
 * without triggering the "setState in effect" lint error.
 */
function useDesktopMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      // The desktop API is injected synchronously by the preload before the
      // renderer runs, so we just need one callback on next tick.
      const id = setTimeout(cb, 0);
      return () => clearTimeout(id);
    },
    () => typeof window !== "undefined" && !!window.desktop, // client snapshot
    () => false // server snapshot
  );
}

/** Lightweight onboarding hint shown the first few seconds. */
function OnboardingHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 9000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 backdrop-blur-md px-4 py-2 shadow-lg">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-medium">桌面宠物 MVP</span>
        <span className="hidden sm:inline text-xs text-muted-foreground">·</span>
        <span className="hidden sm:inline text-xs text-muted-foreground flex items-center gap-1">
          <Hand className="h-3 w-3" /> 拖动
          <span className="mx-1">·</span>
          <MousePointerClick className="h-3 w-3" /> 单击抚摸 / 双击喂食 / 右键菜单
        </span>
      </div>
    </div>
  );
}

/** A small floating pet-name tag near the top-left for context (web mode only). */
function SceneHeader({ desktop }: { desktop: boolean }) {
  const petId = usePetStore((s) => s.petId);
  const meta = getPet(petId);
  // In desktop mode the header would float over the user's real desktop, so hide it.
  if (desktop) return null;
  return (
    <header className="pointer-events-none absolute top-3 left-3 z-10">
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 backdrop-blur-md px-3 py-1.5 shadow-sm">
        <img src={meta.src} alt="" className="pet-sprite h-5 w-5" style={{ imageRendering: "pixelated" }} />
        <div className="leading-tight">
          <div className="text-xs font-semibold">桌面宠物 · Cube Pet</div>
          <div className="text-[10px] text-muted-foreground">低占用 · Kenney 素材</div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  // Detect desktop mode in an SSR-safe way (see useDesktopMode above).
  const desktop = useDesktopMode();

  // Apply desktop-mode body class + tray listeners (client-only effect).
  useEffect(() => {
    if (!desktop) return;
    document.body.classList.add("desktop-mode");
    const unsub = onTrayAction((action) => {
      if (action === "show") showWindow();
      else if (action === "hide") hideWindow();
    });
    return () => {
      document.body.classList.remove("desktop-mode");
      unsub();
    };
  }, [desktop]);

  return (
    <div className={desktop
      ? "relative min-h-screen flex flex-col"
      : "desktop-wallpaper relative min-h-screen flex flex-col"}>
      {!desktop && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      )}

      <SceneHeader desktop={desktop} />
      <OnboardingHint />

      {/* The pet itself, wrapped in a context menu for right-click */}
      <PetContextMenu>
        <div className="contents">
          <DesktopPet />
        </div>
      </PetContextMenu>

      {!desktop && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground/70 max-w-md pointer-events-none">
            <p className="text-sm">
              你的桌面伙伴正在屏幕上溜达～
            </p>
            <p className="text-xs mt-1">
              把它拖到任意位置，单击摸头，双击喂食，右键打开控制面板。
            </p>
            <p className="text-[11px] mt-3 text-muted-foreground/60">
              💡 桌面版（Electron）会是透明置顶窗口，可直接拖动到任意应用之上。
            </p>
          </div>
        </main>
      )}

      {/* Unified floating control panel (no bottom dock).
          Opens via right-click → 控制面板. */}
      <PetDock />
    </div>
  );
}