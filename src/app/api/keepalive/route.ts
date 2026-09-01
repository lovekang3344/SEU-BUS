import { NextRequest, NextResponse } from "next/server";

/**
 * KeepAlive control API (MVP).
 *
 * The real `keepAlive.ps1` is a PowerShell script that simulates a
 * ScrollLock keypress every N seconds to keep the aTrust VPN alive on
 * Windows. In this sandbox we cannot spawn a Windows PowerShell process,
 * so this endpoint keeps an *in-memory* state representing the desired
 * on/off status. A small companion runner (conceptual) would poll this
 * state and start/stop the script accordingly.
 *
 * State is process-local and resets on dev-server restart — enough for the
 * MVP toggle UI. Persisting to the database can come in a later iteration.
 */

interface KeepAliveState {
  enabled: boolean;
  intervalSeconds: number;
  lastToggledAt: string | null;
  lastToggledBy: string | null;
}

const state: KeepAliveState = {
  enabled: false,
  intervalSeconds: 1800,
  lastToggledAt: null,
  lastToggledBy: null,
};

export const dynamic = "force-dynamic";

/** GET /api/keepalive -> current state. */
export async function GET() {
  return NextResponse.json({ ...state });
}

/** POST /api/keepalive { enabled?: boolean, intervalSeconds?: number, by?: string } */
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (typeof body.enabled === "boolean") {
    state.enabled = body.enabled;
    state.lastToggledAt = new Date().toISOString();
    state.lastToggledBy = typeof body.by === "string" ? body.by : "pet";
  }
  if (typeof body.intervalSeconds === "number" && body.intervalSeconds >= 30 && body.intervalSeconds <= 7200) {
    state.intervalSeconds = Math.round(body.intervalSeconds);
  }

  return NextResponse.json({
    ...state,
    note: state.enabled
      ? "KeepAlive 已开启（模拟状态：实际需在 Windows 端运行 keepAlive.ps1）"
      : "KeepAlive 已关闭",
  });
}
