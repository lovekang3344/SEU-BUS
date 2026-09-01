# Cube Pet Desktop（Electron 桌面版）

把 Web 版的桌面宠物打包成真正的 **OS 级桌面宠物**：透明置顶无边框窗口、点击穿透、系统托盘，并用 Node `child_process` 直接 spawn/kill `keepAlive.ps1`。

> 之前用过 Tauri (Rust)，因为 Tauri v2 没有 `setIgnoreMouseEvents(forward: true)` 的等价 API，点击穿透的自动切换需要轮询探测，体验有抖动。已迁移到 Electron，`forward: true` 让鼠标移动事件持续转发给渲染进程，点击穿透零延迟零轮询，体验丝滑。

---

## 一、架构

```
浏览器/Web 预览        ←→    Electron 桌面壳
─────────────────            ──────────────────────
src/app (Next.js)             electron/main.ts       透明置顶窗口 + 托盘 + 点击穿透
  └ page.tsx                  electron/preload.ts    contextBridge 安全暴露 window.desktop
  └ components/desktop-pet    electron/keepalive.ts   child_process spawn keepAlive.ps1
  └ lib/desktop.ts ────────── electron/schedule.ts   fs 读 time.json
       ↑ 双模分流                electron/types.ts     共享 IPC 通道 + 类型
       └ isDesktop() ? invoke : fetch
```

**双模前端**：`src/lib/desktop.ts` 检测 `window.desktop` 是否存在：
- 桌面模式 → 调 `window.desktop.keepalive.start()` 等（走 Electron IPC，真实 PowerShell）
- Web 预览 → 调 `fetch('/api/keepalive')`（走 Next.js API，模拟状态）

同一套前端代码，两种运行环境。

---

## 二、前置依赖（Windows）

1. **Node.js 18+**（你已有 bun，会自动带 node）：<https://nodejs.org/>
2. 不需要 Rust、不需要 MSVC、不需要 WebView2（Electron 自带 Chromium）。

---

## 三、开发运行（热重载）

```powershell
cd E:\leisure\pet_V2
bun install                    # 首次装依赖（1-3 分钟）
bun run electron:dev           # 同时起 Next.js dev + Electron 窗口
```

`electron:dev` 脚本做的事：
1. `concurrently` 并行启动 `next dev -p 3000` 和 Electron
2. `wait-on http://localhost:3000` 等 Next.js 起来
3. Electron 加载 `http://localhost:3000`（带热重载）
4. 自动打开 DevTools（detach 模式，方便调试）

窗口打开后你会看到：透明全屏窗口 → 右下角宠物 → 可拖动/点击 → 底部 dock → 右键菜单。
**鼠标移开宠物/dock 时，点击穿透到下面的桌面/应用**（零延迟，因为 Electron `forward:true`）。

---

## 四、构建安装包（分发）

```powershell
# 1. 生成图标（一次性，已预生成）
bun run gen:icons

# 2. 构建正式版安装包（会先 next export + tsc 编译 electron + electron-builder 打包）
bun run electron:build
```

产物在 `release/`：
- `release/Cube Pet Desktop Setup 0.1.0.exe`（NSIS 安装包，约 80-90MB）

如果想快速测试不打安装包（只产出免安装版目录）：
```powershell
bun run electron:build:dir
```
产物在 `release/win-unpacked/Cube Pet Desktop.exe`，双击即可运行。

---

## 五、点击穿透原理（核心）

Electron 的 `BrowserWindow.setIgnoreMouseEvents(ignore, { forward: true })`：

| `ignore` | `forward` | 点击穿透？ | mousemove 到渲染进程？ |
|---|---|---|---|
| `true` | `false` | ✅ | ❌（JS 拿不到鼠标，死锁） |
| `true` | `true` | ✅ | ✅ **（关键）** |
| `false` | — | ❌ | ✅ |

**策略**（`src/lib/desktop.ts` 的 `attachInteractive`）：
1. 窗口启动 → `setIgnoreMouseEvents(true, { forward: true })`（点击穿透，但 mousemove 持续转发）
2. 渲染进程全局监听 `mousemove`，用 `elementFromPoint` 检测鼠标是否在宠物/dock/面板上
3. 在交互区域上 → `setInteractive(true)` → `setIgnoreMouseEvents(false)` → 接收点击
4. 离开交互区域 → `setInteractive(false)` → `setIgnoreMouseEvents(true, {forward:true})` → 穿透

**面板锁定**：面板打开时 `lockInteractive(true)` 强制保持接收模式，面板关闭时 `lockInteractive(false)`。这样面板永远不会"失效"。

**面板自动收起**：鼠标离开面板+dock 2.5 秒后面板自动收起，顶部有琥珀色倒计时进度条提示。

---

## 六、keepAlive.ps1 真实控制

`electron/keepalive.ts` 用 Node `child_process.spawn`：

```js
spawn("powershell.exe", [
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", scriptPath,
  "-IntervalSeconds", String(intervalSeconds),
], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
```

- `windowsHide: true` → PowerShell 静默后台运行（无窗口）
- `stdio: pipe` → 后台线程读 stdout/stderr 喂给前端日志面板
- `ka_start` → kill 旧进程 → spawn 新进程
- `ka_stop` → kill 进程
- 进程退出自动更新状态并通知前端

**路径解析**：
- 开发模式：`<project>/data/keepAlive.ps1`
- 打包后：`process.resourcesPath/data/keepAlive.ps1`（electron-builder 的 `extraResources` 配置已自动复制）

---

## 七、文件结构

```
electron/
├── main.ts          # 透明窗口 + 托盘 + IPC 注册 + 点击穿透
├── preload.ts       # contextBridge 暴露 window.desktop
├── keepalive.ts     # child_process 控制 keepAlive.ps1 + 日志收集
├── schedule.ts      # fs 读 time.json
└── types.ts        # 共享 IPC 通道名 + 类型 + DesktopApi 接口

src/lib/desktop.ts   # 双模 IPC 客户端（electron/web 分流）
data/                # keepAlive.ps1 + time.json（打包进 resources）
build/               # 应用图标（icon.ico/icon.png）
out/                 # next build --output export 的静态站（打包时生成）
dist-electron/       # tsc 编译后的 electron JS（打包时生成）
release/             # electron-builder 产物（Setup .exe）
electron-builder.yml # 打包配置
tsconfig.electron.json # electron 专用 tsconfig（CommonJS + node types）
```

---

## 八、与 Web 预览版的区别

| 功能 | Web 预览 | Electron 桌面版 |
|---|---|---|
| 窗口 | 浏览器标签页 | 透明置顶全屏窗口 |
| 点击穿透 | ❌ | ✅ `forward:true` 零延迟 |
| keepAlive.ps1 | 模拟状态 | **真实 spawn/kill PowerShell** |
| time.json | Next API 读取 | **Node fs 直接读** |
| 系统托盘 | ❌ | ✅ 显示/隐藏/退出 |
| 任务栏图标 | 浏览器 | 跳过任务栏（仅托盘） |
| 日志面板 | ❌ | ✅ 实时 PowerShell stdout |
| 安装包 | 0 | ~80-90 MB |
| 常驻内存 | 浏览器进程 | ~100-150 MB |

---

## 九、常见问题

**Q: `bun run electron:dev` 报 "electron not found"**
A: `bun install` 没装 electron。单独装：`bun add -d electron`。

**Q: 窗口打开后白屏**
A: 检查 Next.js 是否在 3000 起来了。`electron:dev` 用 `wait-on` 等 3000，但偶尔网络检测慢。手动验证 `curl http://localhost:3000`。

**Q: 点宠物没反应**
A: 看 DevTools console（自动打开的）有没有 `window.desktop` 报错。应该是 `undefined` 的话说明 preload 没加载——检查 `electron/main.ts` 的 `preload` 路径是否指向 `dist-electron/preload.js`。如果 `dist-electron/` 不存在，先 `npx tsc -p tsconfig.electron.json`。

**Q: KeepAlive 报 "keepAlive.ps1 not found"**
A: 确认 `data/keepAlive.ps1` 存在。开发模式从项目根 `data/` 读；打包后从 `resources/data/` 读。

**Q: 想换图标**
A: 把源图（建议 256x256 PNG）放到任意位置，改 `scripts/gen-icons.mjs` 的 `SRC`，跑 `bun run gen:icons`，会重新生成到 `build/`。

**Q: 打包后体积太大**
A: electron-builder 默认全平台 Chromium。可以在 `electron-builder.yml` 的 `win.target` 只保留 `nsis` + `x64`（已配置）。还能加 `electron-builder --arm64` 等。

---

## 十、从 Tauri 迁移说明（给已读过旧 README 的你）

- 删除 `src-tauri/`（Rust 项目）
- 删除 `@tauri-apps/api` 依赖
- 新增 `electron/` 目录（main/preload/keepalive/schedule/types）
- `src/lib/desktop.ts` 重写：`invoke` → `window.desktop.xxx`
- 点击穿透：从"轮询探测"改为"`forward:true` 持续 mousemove 检测"
- 打包：`tauri build` → `electron-builder`
- 脚本：`tauri:dev` → `electron:dev`，`tauri:build` → `electron:build`

前端组件代码（DesktopPet/PetDock/PetPicker/SchedulePanel/KeepAliveToggle/PetContextMenu）**完全没变**，因为它们只依赖 `src/lib/desktop.ts` 的抽象接口。
