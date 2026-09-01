"use client";

import { useEffect, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PETS, type PetId } from "@/lib/pets";
import { usePetStore } from "@/hooks/use-pet-store";
import { isDesktop, lockInteractive, registerInteractiveZone } from "@/lib/desktop";
import { Heart, Utensils, Moon, Sun, Footprints, Cat, Settings2, LayoutGrid } from "lucide-react";

function petAction(action: string) {
  window.dispatchEvent(new CustomEvent("pet-action", { detail: action }));
}

/**
 * While any context menu (main or sub) is open:
 *  1. Lock the Electron window into "receive mouse" mode (so clicks can't
 *     pass through to the desktop while the user is choosing an item).
 *  2. Find the Radix portal element(s) rendered to document.body and register
 *     them as interactive zones, so checkAt() recognizes the cursor is over
 *     a menu and doesn't flip back to click-through.
 *
 * This fixes the bug where right-click → "换宠物" submenu is unclickable:
 * the portal lives outside panelRef/footerRef, so without registration the
 * click-through logic thought the cursor was "off-zone" and let clicks
 * pass through to the desktop.
 */
function useMenuInteractiveLock(isOpen: boolean) {
  // Lock/unlock.
  useEffect(() => {
    if (!isDesktop() || !isOpen) return;
    lockInteractive(true);
    return () => lockInteractive(false);
  }, [isOpen]);

  // Register all Radix menu portals currently in the DOM as interactive zones.
  useEffect(() => {
    if (!isDesktop() || !isOpen) return;
    const registered = new Set<HTMLElement>();
    const unregs: Array<() => void> = [];
    const register = () => {
      const portals = document.querySelectorAll<HTMLElement>(
        "[data-radix-popper-content-wrapper], [data-radix-context-menu-content], [role=menu]"
      );
      portals.forEach((el) => {
        if (registered.has(el)) return;
        registered.add(el);
        unregs.push(registerInteractiveZone(el));
      });
    };
    register();
    const id = setTimeout(register, 0);
    const observer = new MutationObserver(() => register());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(id);
      observer.disconnect();
      unregs.forEach((u) => u());
      registered.clear();
    };
  }, [isOpen]);
}

export function PetContextMenu({ children }: { children: React.ReactNode }) {
  const petId = usePetStore((s) => s.petId);
  const setPetId = usePetStore((s) => s.setPetId);
  const activity = usePetStore((s) => s.activity);
  const autonomy = usePetStore((s) => s.autonomy);
  const setAutonomy = usePetStore((s) => s.setAutonomy);
  const say = usePetStore((s) => s.say);
  const scale = usePetStore((s) => s.scale);
  const setScale = usePetStore((s) => s.setScale);

  const [menuOpen, setMenuOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  // Lock whenever the main menu OR any submenu is open.
  useMenuInteractiveLock(menuOpen || subOpen);

  return (
    <ContextMenu onOpenChange={(open) => setMenuOpen(open)}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => petAction("pet")}>
          <Heart className="mr-2 h-4 w-4" /> 摸摸头
        </ContextMenuItem>
        <ContextMenuItem onClick={() => petAction("feed")}>
          <Utensils className="mr-2 h-4 w-4" /> 喂食
        </ContextMenuItem>
        <ContextMenuItem onClick={() => petAction("walk")}>
          <Footprints className="mr-2 h-4 w-4" /> 溜达一下
        </ContextMenuItem>
        {activity === "sleeping" ? (
          <ContextMenuItem onClick={() => petAction("wake")}>
            <Sun className="mr-2 h-4 w-4" /> 叫醒
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => petAction("sleep")}>
            <Moon className="mr-2 h-4 w-4" /> 睡觉
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Open the unified control panel (替代底部 dock) */}
        <ContextMenuItem onClick={() => window.dispatchEvent(new CustomEvent("pet-open-panel"))}>
          <LayoutGrid className="mr-2 h-4 w-4" /> 控制面板
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub onOpenChange={(open) => setSubOpen(open)}>
          <ContextMenuSubTrigger>
            <Cat className="mr-2 h-4 w-4" /> 换宠物
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44 max-h-72 overflow-y-auto pet-scroll">
            {PETS.map((p) => (
              <ContextMenuItem
                key={p.id}
                disabled={p.id === petId}
                onClick={() => { setPetId(p.id as PetId); say(`变成 ${p.nameCn} 啦～`, "happy", 2000); }}
              >
                <span className="mr-2 text-base">{p.emoji}</span>
                <span className={p.id === petId ? "font-semibold" : ""}>{p.nameCn}</span>
                {p.id === petId && <span className="ml-auto text-xs text-muted-foreground">当前</span>}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub onOpenChange={(open) => setSubOpen(open)}>
          <ContextMenuSubTrigger>
            <Settings2 className="mr-2 h-4 w-4" /> 设置
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <ContextMenuItem onClick={() => setAutonomy(!autonomy)}>
              <Footprints className="mr-2 h-4 w-4" />
              自主活动
              <span className="ml-auto text-xs">{autonomy ? "开" : "关"}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setScale(Math.min(1.5, scale + 0.15))}>
              <span className="mr-2">🔍</span> 放大
              <span className="ml-auto text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setScale(Math.max(0.75, scale - 0.15))}>
              <span className="mr-2">🔎</span> 缩小
              <span className="ml-auto text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}