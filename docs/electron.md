# 桌面端（Electron）架构 — 阶段 8

## 进程模型

```
┌──────────────────────────────────────────────────────────────┐
│ Electron Main (Node)                                         │
│  - app lifecycle / window / system tray / auto-updater       │
│  - 内嵌 core 服务（不启动子进程，减少开销）                  │
│  - 文件系统、SQLite、build orchestrator 在主进程内运行       │
└────────────────┬─────────────────────────────────────────────┘
                 │  contextBridge 暴露的 IPC 接口（只读 + 强类型）
┌────────────────┴─────────────────────────────────────────────┐
│ Electron Renderer (Chromium)                                 │
│  - React + Vite 打包产物（与 apps/web 共享组件）             │
│  - useApi(): 类型化 RPC client                               │
│  - 不直接访问 fs / child_process / sqlite                    │
└──────────────────────────────────────────────────────────────┘
```

## IPC 接口设计

`preload.ts`：

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mcforgelab", {
  invoke<R = unknown>(method: string, ...args: unknown[]): Promise<R> {
    return ipcRenderer.invoke(`mcforgelab/${method}`, ...args);
  },
  on(event: string, handler: (...args: unknown[]) => void): () => void {
    const wrap = (_: unknown, ...args: unknown[]) => handler(...args);
    ipcRenderer.on(`mcforgelab/${event}`, wrap);
    return () => ipcRenderer.off(`mcforgelab/${event}`, wrap);
  }
});
```

主进程注册 handler，转发给 core 包，禁止 renderer 直接 `require`。

## SQLite native module 重建

阶段 8 引入 `electron-rebuild` 自动重建 `better-sqlite3`：

```json
{
  "scripts": {
    "postinstall": "electron-rebuild --module-dir node_modules/better-sqlite3"
  }
}
```

## 数据目录

使用 Electron `app.getPath('userData')` 作为 workspace 根，避免污染用户家目录中的其他工具。

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\MC-ForgeLab\` |
| macOS | `~/Library/Application Support/MC-ForgeLab/` |
| Linux | `~/.config/MC-ForgeLab/` |

## Full Bundle / Lite Bundle

| 包 | 工具链 | 体积 | 适合 |
|----|--------|-----|------|
| Full | 内置 JDK 17/21 + Gradle + Maven | ~600 MB | 小白用户、离线环境 |
| Lite | 仅 UI / core | ~120 MB | 已有工具链、有稳定网络 |

Lite 首次启动 → 引导向导：

```
欢迎使用 MC-ForgeLab
================================
检测到首次启动，需要下载构建工具链：

[ ✓ ] Java 17 (Adoptium) — 180 MB
[ ✓ ] Java 21 (Adoptium) — 200 MB
[ ✓ ] Gradle 8.10 — 130 MB

总计 510 MB     [  下载  ]  [  跳过（高级用户）  ]
```

下载进度展示、sha256 校验、失败重试，**不污染**用户系统 PATH。

## 自动更新

`electron-updater` + 自托管 release feed（阶段 8 后期）。

## 文件关联

`.mcforgelab` 项目描述文件：双击 → 启动应用并加载项目。

## 系统托盘

- 当前运行的构建数量
- 快速打开主窗口
- 退出
