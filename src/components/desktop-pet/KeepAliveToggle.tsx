"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Power, Activity, Timer, Terminal } from "lucide-react";
import { usePetStore } from "@/hooks/use-pet-store";
import {
  isDesktop, getKeepAlive, startKeepAlive, stopKeepAlive, onKeepAliveUpdate,
  type KeepAliveState,
} from "@/lib/desktop";

function emptyState(): KeepAliveState {
  return {
    enabled: false,
    intervalSeconds: 1800,
    lastToggledAt: null,
    lastToggledBy: null,
    processRunning: false,
    logTail: [],
  };
}

export function KeepAliveToggle({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<KeepAliveState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const say = usePetStore((s) => s.say);
  const unsubRef = useRef<(() => void) | null>(null);

  // initial load — inline async IIFE so setState is deferred (rule-safe)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getKeepAlive();
        if (!cancelled) setState(s);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();

    // subscribe to live updates (log lines, process exit) in desktop mode
    if (isDesktop()) {
      const unsub = onKeepAliveUpdate((s) => setState(s));
      if (cancelled) { unsub(); } else { unsubRef.current = unsub; }
    }

    return () => {
      cancelled = true;
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, []);

  const toggle = useCallback(async (enabled: boolean) => {
    setSaving(true);
    try {
      const next = enabled
        ? await startKeepAlive(state.intervalSeconds)
        : await stopKeepAlive();
      setState(next);
      say(
        enabled ? "KeepAlive 已开启，VPN 保活中～" : "KeepAlive 已关闭",
        "info", 2500
      );
    } catch (e) {
      say(`KeepAlive 操作失败：${(e as Error).message}`, "info", 4000);
    }
    setSaving(false);
  }, [state.intervalSeconds, say]);

  const setInterval2 = useCallback(async (sec: number) => {
    setSaving(true);
    try {
      // If running, restart with the new interval; otherwise just persist.
      const cur = state.enabled;
      const next = cur
        ? await startKeepAlive(sec)
        : await (async () => {
            // web fallback path persists interval; desktop stop+start not needed
            // because interval is only applied at start. We just store locally.
            setState((s) => ({ ...s, intervalSeconds: sec }));
            return { ...state, intervalSeconds: sec };
          })();
      setState(next);
    } catch { /* ignore */ }
    setSaving(false);
  }, [state]);

  const minutes = Math.round(state.intervalSeconds / 60);
  const lastToggled = state.lastToggledAt
    ? formatStamp(state.lastToggledAt)
    : "—";

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-amber-600" />
            aTrust KeepAlive
          </CardTitle>
          <Badge
            variant={state.enabled ? "default" : "secondary"}
            className={state.enabled ? "bg-emerald-600 hover:bg-emerald-600" : ""}
          >
            {loading ? "…" : state.enabled ? (state.processRunning ? "运行中" : "已启用") : "已停止"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Power className={`h-4 w-4 ${state.enabled ? "text-emerald-600" : "text-muted-foreground"}`} />
            <div>
              <div className="text-sm font-medium">保活开关</div>
              <div className="text-[11px] text-muted-foreground">
                模拟 ScrollLock 按键
                {isDesktop() && <span className="ml-1 text-emerald-600">· 本地进程</span>}
              </div>
            </div>
          </div>
          <Switch
            checked={state.enabled}
            disabled={loading || saving}
            onCheckedChange={toggle}
            aria-label="切换 KeepAlive"
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">触发间隔</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{minutes} 分钟</span>
          </div>
          <Slider
            value={[state.intervalSeconds]}
            min={60}
            max={3600}
            step={60}
            disabled={loading || saving}
            onValueCommit={(v) => setInterval2(v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 分</span><span>60 分</span>
          </div>
        </div>

        {/* Live log (desktop mode only — shows real PowerShell stdout) */}
        {isDesktop() && state.logTail.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-zinc-950/90 px-3 py-2 max-h-28 overflow-y-auto pet-scroll">
            <div className="text-[10px] font-mono text-emerald-400/90 leading-relaxed">
              {state.logTail.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> 最近切换</span>
            <span className="font-mono">{lastToggled}</span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          {isDesktop()
            ? "桌面版：实际运行 keepAlive.ps1（Rust spawn PowerShell），可查看实时日志。"
            : "Web 预览：模拟状态。桌面版会实际运行 keepAlive.ps1。"}
        </p>

        {onClose && (
          <div className="flex justify-end pt-1 border-t">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>收起</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Format the epoch stamp from Rust ("epoch:1234567890") into a local string. */
function formatStamp(s: string): string {
  const m = /^epoch:(\d+)$/.exec(s);
  if (!m) return s;
  const t = parseInt(m[1], 10) * 1000;
  return new Date(t).toLocaleString("zh-CN", { hour12: false });
}
