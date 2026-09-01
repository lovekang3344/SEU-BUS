/**
 * Desktop pet state store (Zustand).
 *
 * Keeps the pet's identity, screen position, current activity/mood,
 * autonomy settings and keeps it persisted to localStorage so the pet
 * "remembers" you across reloads — a small but important detail for a
 * desktop companion.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PetId } from "@/lib/pets";
import { DEFAULT_PET } from "@/lib/pets";

export type PetActivity = "idle" | "walking" | "happy" | "sleeping" | "eating" | "dragged";
export type PetFacing = "left" | "right";

export interface SpeechBubble {
  id: number;
  text: string;
  kind: "info" | "happy" | "reminder" | "sleep";
  createdAt: number;
}

interface PetState {
  // identity
  petId: PetId;
  setPetId: (id: PetId) => void;

  // position (in viewport px from top-left)
  x: number;
  y: number;
  setPosition: (x: number, y: number) => void;

  // facing / scale
  facing: PetFacing;
  setFacing: (f: PetFacing) => void;
  scale: number;       // user zoom 0.75 .. 1.5
  setScale: (s: number) => void;

  // activity / mood
  activity: PetActivity;
  setActivity: (a: PetActivity) => void;

  // autonomy: pet wanders around on its own when enabled
  autonomy: boolean;
  setAutonomy: (v: boolean) => void;

  // speech bubbles queue
  bubbles: SpeechBubble[];
  say: (text: string, kind?: SpeechBubble["kind"], ttlMs?: number) => void;
  dismissBubble: (id: number) => void;

  // stats (lightweight tamagotchi-style flavor)
  happiness: number;   // 0..100
  energy: number;       // 0..100
  lastInteractionAt: number;
  bumpHappiness: (delta: number) => void;
  bumpEnergy: (delta: number) => void;
  touch: () => void;

  // schedule preferences (for the reminder integration)
  scheduleOrigin: string;
  setScheduleOrigin: (o: string) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  /** How many minutes before departure to fire the reminder. Default 10. */
  reminderLeadMinutes: number;
  setReminderLeadMinutes: (v: number) => void;
  /** "auto" = compute from day-of-week; "workday"/"holiday" = manual override. */
  dayTypeOverride: "auto" | "workday" | "holiday";
  setDayTypeOverride: (v: "auto" | "workday" | "holiday") => void;
}

let bubbleSeq = 1;

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
      petId: DEFAULT_PET,
      setPetId: (id) => set({ petId: id, happiness: Math.min(100, get().happiness + 5) }),

      // default position: lower-right area, will be clamped by component on mount
      x: -1,
      y: -1,
      setPosition: (x, y) => set({ x, y }),

      facing: "right",
      setFacing: (facing) => set({ facing }),
      scale: 1,
      setScale: (scale) => set({ scale: Math.min(1.5, Math.max(0.75, scale)) }),

      activity: "idle",
      setActivity: (activity) => set({ activity }),

      autonomy: true,
      setAutonomy: (autonomy) => set({ autonomy }),

      bubbles: [],
      say: (text, kind = "info", ttlMs = 5000) => {
        const id = bubbleSeq++;
        const bubble: SpeechBubble = { id, text, kind, createdAt: Date.now() };
        // Replace ALL existing bubbles with just this new one. This avoids
        // stale bubbles stacking up when the user clicks rapidly — only the
        // latest message is shown, and its own dismiss timer is the only one
        // active (no orphan timers from older bubbles).
        set({ bubbles: [bubble] });
        setTimeout(() => {
          // Only dismiss if this bubble is still the latest one (avoid a
          // late timer from an older bubble wiping a newer one).
          const cur = get().bubbles;
          if (cur.length === 1 && cur[0].id === id) {
            set({ bubbles: [] });
          } else {
            set({ bubbles: cur.filter((b) => b.id !== id) });
          }
        }, ttlMs);
      },
      dismissBubble: (id) =>
        set({ bubbles: get().bubbles.filter((b) => b.id !== id) }),

      happiness: 80,
      energy: 70,
      lastInteractionAt: Date.now(),
      bumpHappiness: (delta) =>
        set({ happiness: Math.min(100, Math.max(0, get().happiness + delta)) }),
      bumpEnergy: (delta) =>
        set({ energy: Math.min(100, Math.max(0, get().energy + delta)) }),
      touch: () => set({ lastInteractionAt: Date.now() }),

      scheduleOrigin: "橘园",
      setScheduleOrigin: (scheduleOrigin) => set({ scheduleOrigin }),
      remindersEnabled: true,
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      reminderLeadMinutes: 10,
      setReminderLeadMinutes: (reminderLeadMinutes) =>
        set({ reminderLeadMinutes: Math.min(60, Math.max(1, Math.round(reminderLeadMinutes))) }),
      dayTypeOverride: "auto",
      setDayTypeOverride: (dayTypeOverride) => set({ dayTypeOverride }),
    }),
    {
      name: "desktop-pet-state",
      // Don't persist transient runtime fields
      partialize: (s) => ({
        petId: s.petId,
        x: s.x,
        y: s.y,
        facing: s.facing,
        scale: s.scale,
        autonomy: s.autonomy,
        happiness: s.happiness,
        energy: s.energy,
        scheduleOrigin: s.scheduleOrigin,
        remindersEnabled: s.remindersEnabled,
        reminderLeadMinutes: s.reminderLeadMinutes,
        dayTypeOverride: s.dayTypeOverride,
      }),
    }
  )
);
