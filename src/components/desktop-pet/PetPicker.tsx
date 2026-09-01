"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PETS, type PetId } from "@/lib/pets";
import { usePetStore } from "@/hooks/use-pet-store";
import { Sparkles } from "lucide-react";
import { QuickActions } from "./QuickActions";

export function PetPicker({ onClose }: { onClose?: () => void }) {
  const petId = usePetStore((s) => s.petId);
  const setPetId = usePetStore((s) => s.setPetId);
  const say = usePetStore((s) => s.say);

  return (
    <Card className="w-full max-w-md border-border/60 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-600" />
            选择你的桌面伙伴
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{PETS.length} 种</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <QuickActions />
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto pet-scroll pr-1">
          {PETS.map((p) => {
            const active = p.id === petId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPetId(p.id as PetId);
                  say(`变成 ${p.nameCn} 啦～`, "happy", 2000);
                }}
                title={`${p.nameCn} · ${p.tagline}`}
                className={`group relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-all hover:scale-[1.04] hover:shadow-md ${
                  active
                    ? "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30 ring-2 ring-violet-300/50"
                    : "border-border/50 bg-card/50 hover:border-violet-300/60"
                }`}
              >
                <img
                  src={p.src}
                  alt={p.nameCn}
                  draggable={false}
                  className="pet-sprite h-14 w-14 object-contain aspect-square"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="text-[11px] font-medium leading-none">{p.nameCn}</span>
                {active && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {onClose && (
          <div className="flex justify-end pt-3 border-t mt-3">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>收起</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
