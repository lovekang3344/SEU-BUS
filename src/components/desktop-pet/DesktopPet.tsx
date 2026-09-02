"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePetStore, type PetActivity } from "@/hooks/use-pet-store";
import { getPet } from "@/lib/pets";
import { attachInteractive } from "@/lib/desktop";
import { unlockAudio } from "@/lib/sound";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const PET_BASE = 96; // rendered sprite size in px (source is 64, upscaled pixelated)

function activityAnim(a: PetActivity): string {
  switch (a) {
    case "happy": return "pet-anim-happy";
    case "walking": return "pet-anim-walk";
    case "eating": return "pet-anim-eat";
    case "sleeping": return "pet-anim-sleep";
    case "dragged": return "pet-anim-dragged";
    default: return "pet-anim-idle";
  }
}

interface Heart { id: number; hx: number; }
let heartSeq = 1;

interface Zzz { id: number; }
let zzzSeq = 1;

/** Clamp a value into [min,max]. */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------------ */
/*  Pet speech bubble                                                 */
/* ------------------------------------------------------------------ */

function SpeechBubbles() {
  const bubbles = usePetStore((s) => s.bubbles);
  const dismiss = usePetStore((s) => s.dismissBubble);
  const accent = usePetStore((s) => getPet(s.petId).accent);

  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" style={{ bottom: "100%", marginBottom: 12 }}>
      {bubbles.map((b) => (
        <div
          key={b.id}
          onClick={() => dismiss(b.id)}
          className="bubble-pop pointer-events-auto cursor-pointer w-max max-w-[420px]"
        >
          <div
            className="relative rounded-2xl px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm border break-words whitespace-normal text-left leading-relaxed"
            style={{
              background: "oklch(0.98 0.01 0 / 0.94)",
              borderColor: `hsl(${accent} / 0.45)`,
              color: "oklch(0.2 0.02 260)",
            }}
          >
            {b.kind === "reminder" && <span className="mr-1">🚌</span>}
            {b.kind === "happy" && <span className="mr-1">💛</span>}
            {b.kind === "sleep" && <span className="mr-1">💤</span>}
            {b.text}
            <span
              className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 h-3 w-3 rotate-45 border-r border-b"
              style={{
                background: "oklch(0.98 0.01 0 / 0.94)",
                borderColor: `hsl(${accent} / 0.45)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The pet                                                           */
/* ------------------------------------------------------------------ */

export function DesktopPet() {
  const petId = usePetStore((s) => s.petId);
  const meta = getPet(petId);
  const x = usePetStore((s) => s.x);
  const y = usePetStore((s) => s.y);
  const facing = usePetStore((s) => s.facing);
  const scale = usePetStore((s) => s.scale);
  const activity = usePetStore((s) => s.activity);
  const autonomy = usePetStore((s) => s.autonomy);
  const setPosition = usePetStore((s) => s.setPosition);
  const setFacing = usePetStore((s) => s.setFacing);
  const setActivity = usePetStore((s) => s.setActivity);
  const say = usePetStore((s) => s.say);
  const bumpHappiness = usePetStore((s) => s.bumpHappiness);
  const bumpEnergy = usePetStore((s) => s.bumpEnergy);
  const touch = usePetStore((s) => s.touch);

  // local interaction state
  const [dragging, setDragging] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [zzz, setZzz] = useState<Zzz[]>([]);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const downAt = useRef({ x: 0, y: 0, t: 0 });
  const movedRef = useRef(false);
  const walkTarget = useRef<{ x: number; y: number; until: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // ----- initial placement: bottom-right if unset -----
  useEffect(() => {
    if (x < 0 || y < 0) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition(
        clamp(vw - PET_BASE - 80, 40, vw - PET_BASE - 40),
        clamp(vh - PET_BASE - 180, 40, vh - PET_BASE - 140)
      );
    }
  }, []);

  // ----- tab visibility: pause autonomous walks when hidden (low resource) -----
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ----- pet interaction: click to pet (happy + hearts) -----
  const spawnHearts = useCallback(() => {
    const batch = Array.from({ length: 3 }, () => ({
      id: heartSeq++,
      hx: Math.round((Math.random() - 0.5) * 50),
    }));
    setHearts((h) => [...h, ...batch].slice(-9));
    setTimeout(() => {
      setHearts((h) => h.filter((it) => !batch.some((b) => b.id === it.id)));
    }, 1500);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Unlock audio on first interaction (browser autoplay policy requires a
    // user gesture). Subsequent reminder chimes will then actually play.
    unlockAudio();
    downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    movedRef.current = false;
    dragOffset.current = { dx: e.clientX - x, dy: e.clientY - y };
    setDragging(true);
    setActivity("dragged");
    touch();
  }, [x, y, setActivity, touch]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const nx = e.clientX - dragOffset.current.dx;
    const ny = e.clientY - dragOffset.current.dy;
    const movedDist = Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y);
    if (movedDist > 4) movedRef.current = true;
    setPosition(
      clamp(nx, 4, window.innerWidth - PET_BASE * scale - 4),
      clamp(ny, 4, window.innerHeight - PET_BASE * scale - 4)
    );
  }, [dragging, setPosition, scale]);

  const endDrag = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    setActivity("idle");
    // if it was a click (not a drag), treat as a pet
    if (!movedRef.current) {
      setActivity("happy");
      spawnHearts();
      bumpHappiness(8);
      say(meta.nameCn + " 很开心～", "happy", 2200);
      setTimeout(() => setActivity("idle"), 1400);
    }
  }, [dragging, setActivity, spawnHearts, bumpHappiness, say, meta.nameCn]);

  // ----- double-click: feed -----
  const handleDoubleClick = useCallback(() => {
    setActivity("eating");
    bumpEnergy(15);
    bumpHappiness(5);
    say("好好吃！🍗", "happy", 2000);
    setTimeout(() => setActivity("idle"), 1600);
  }, [setActivity, bumpEnergy, bumpHappiness, say]);

  // sleep / wake
  const sleep = useCallback(() => {
    usePetStore.setState({ activity: "sleeping" });
    say("呼噜噜…💤", "sleep", 3000);
  }, [say]);
  const wake = useCallback(() => {
    usePetStore.setState({ activity: "idle" });
  }, []);

  // expose interaction handlers via window event for context menu / dock
  useEffect(() => {
    const api = {
      pet: () => { setActivity("happy"); spawnHearts(); bumpHappiness(8); say("喵呜～", "happy", 2000); setTimeout(() => setActivity("idle"), 1400); },
      feed: handleDoubleClick,
      sleep,
      wake,
      walk: () => { usePetStore.setState({ activity: "walking" }); say("出去溜达溜达～", "info", 1800); },
    };
    (window as any).__petApi = api;
    const onReq = (e: Event) => {
      const detail = (e as CustomEvent).detail as keyof typeof api;
      if (api[detail]) api[detail]();
    };
    window.addEventListener("pet-action", onReq as EventListener);
    return () => window.removeEventListener("pet-action", onReq as EventListener);
  }, [setActivity, spawnHearts, bumpHappiness, say, handleDoubleClick, sleep, wake]);

  // ----- sleeping Zzz particles -----
  useEffect(() => {
    if (activity !== "sleeping") {
      setZzz([]);
      return;
    }
    const iv = setInterval(() => {
      setZzz((z) => [...z, { id: zzzSeq++ }].slice(-4));
    }, 900);
    return () => clearInterval(iv);
  }, [activity]);

  // ----- autonomy: occasional walk to a nearby random spot -----
  useEffect(() => {
    if (!autonomy || dragging) return;
    if (activity === "sleeping" || activity === "eating" || activity === "happy") return;

    let cancelled = false;
    const delay = 12000 + Math.random() * 16000; // 12-28s
    const t = window.setTimeout(() => {
      if (cancelled || !visibleRef.current || document.hidden) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tx = clamp(x + (Math.random() - 0.5) * 280, 20, vw - PET_BASE * scale - 20);
      const ty = clamp(y + (Math.random() - 0.5) * 180, 20, vh - PET_BASE * scale - 20);
      walkTarget.current = { x: tx, y: ty, until: Date.now() + 6000 };
      setFacing(tx < x ? "left" : "right");
      setActivity("walking");
    }, delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, [autonomy, dragging, activity, x, y, scale]);

  // ----- RAF: walk toward target, then settle -----
  useEffect(() => {
    if (activity !== "walking" || !walkTarget.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = () => {
      if (!visibleRef.current || document.hidden) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const target = walkTarget.current;
      if (!target) return;
      const cur = usePetStore.getState();
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2 || Date.now() > target.until) {
        walkTarget.current = null;
        setActivity("idle");
        return;
      }
      const speed = 1.6; // px per frame
      const nx = cur.x + (dx / dist) * speed;
      const ny = cur.y + (dy / dist) * speed;
      setPosition(
        clamp(nx, 4, window.innerWidth - PET_BASE * scale - 4),
        clamp(ny, 4, window.innerHeight - PET_BASE * scale - 4)
      );
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activity, setPosition, scale]);

  // energy drain over time; sleep recovers energy
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      const a = usePetStore.getState().activity;
      if (a === "sleeping") bumpEnergy(2);
      else if (a !== "dragged") bumpEnergy(-1);
    }, 20000);
    return () => clearInterval(iv);
  }, [bumpEnergy]);

  // auto-sleep when energy very low
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      const s = usePetStore.getState();
      if (s.energy < 18 && s.activity === "idle") sleep();
    }, 10000);
    return () => clearInterval(iv);
  }, [sleep]);

  // greet on mount
  useEffect(() => {
    const t = setTimeout(() => {
      say(`${meta.nameCn}(${meta.name})上线啦～点我摸摸头！`, "info", 4000);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // click-through: in desktop mode, only the pet catches clicks; the rest of
  // the transparent window lets mouse events pass through to the real desktop.
  useEffect(() => {
    return attachInteractive(rootRef.current);
  }, []);

  const anim = activityAnim(activity);
  const spriteSize = PET_BASE * scale;

  return (
    <div
      ref={rootRef}
      className="fixed z-40 select-none"
      style={{
        left: x,
        top: y,
        width: spriteSize,
        height: spriteSize + 18,
        transition: dragging ? "none" : "left 0.08s linear, top 0.08s linear",
      }}
    >
      <SpeechBubbles />

      {/* Zzz particles */}
      {zzz.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 z-10 h-0">
          {zzz.map((z) => (
            <span
              key={z.id}
              className="zzz-particle absolute text-lg font-bold text-sky-500/80"
              style={{ left: 0, top: 0 }}
            >
              z
            </span>
          ))}
        </div>
      )}

      {/* hearts */}
      {hearts.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 z-10 h-0">
          {hearts.map((h) => (
            <span
              key={h.id}
              className="heart-particle absolute text-xl"
              style={{ ["--hx" as any]: `${h.hx}px`, left: 0, top: 0 }}
            >
              💗
            </span>
          ))}
        </div>
      )}

      {/* clickable / draggable body */}
      <div
        role="button"
        aria-label={`${meta.nameCn} desktop pet. Drag to move, click to pet, double-click to feed.`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === " ") { e.preventDefault(); spawnHearts(); setActivity("happy"); bumpHappiness(5); }
        }}
        className="relative cursor-grab active:cursor-grabbing focus-visible:outline-none"
        style={{ width: spriteSize, height: spriteSize }}
        title={`${meta.nameCn} · 拖动移动 · 单击抚摸 · 双击喂食`}
      >
        {/* shadow */}
        <div
          className="pet-shadow absolute left-1/2 -translate-x-1/2 rounded-[50%]"
          style={{
            bottom: -6,
            width: spriteSize * 0.7,
            height: spriteSize * 0.18,
            opacity: dragging ? 0.5 : 0.9,
          }}
        />
        {/* sprite */}
        <img
          src={meta.src}
          alt={meta.nameCn}
          draggable={false}
          className={`pet-sprite ${anim} relative z-[1]`}
          style={{
            width: spriteSize,
            height: spriteSize,
            transform: `${facing === "left" ? "scaleX(-1)" : ""}`,
            transformOrigin: "center bottom",
          }}
        />
      </div>
    </div>
  );
}
