# MC-ForgeLab 总体架构

## 1. 定位

四端（Windows / macOS / Linux / Docker）Minecraft 插件、模组、混合端**生成—编译—打包—下载**一体化平台。

- 桌面端（Win/macOS/Linux）：GUI + CLI，普通用户无需自备 Java/Gradle/Maven/Node/Git
- Docker：WebUI 模式（不要求进容器敲命令）
- CLI：高级用户与自动化脚本
- 产品原则：**完整闭环**（创建 → 编译 → 打包 → 下载），**不**做单纯模板仓库

## 2. 技术栈

| 层 | 技术 |
|---|---|
| Monorepo | pnpm workspaces + turbo |
| 语言 | TypeScript（strict 全开） |
| 构建 | tsc + project references |
| 测试 | vitest workspace |
| Logger | 自研结构化 logger（接口可替换为 pino） |
| SQLite | better-sqlite3（ESM adapter 隔离 CJS native） |
| CLI 框架 | commander + cli-table3 + picocolors |
| Web 后端 (阶段 3+) | Node.js + Fastify + SSE |
| Web 前端 (阶段 3+) | React + Vite + Tailwind v3.4 + shadcn/ui + TanStack Query + Zustand |
| 桌面 (阶段 8) | Electron + 复用 web 组件 |
| i18n | i18next（默认 zh-CN，备 en） |
| 国际化错误 | AppError 内置 messageZh/messageEn |

## 3. 模块分层与依赖 DAG

```
                       core
                        │
              ┌─────────┴─────────┐
              │                   │
          app-error           （仅类型）
              │
   ┌──────────┼───────────────────────────────┐
   │          │                               │
 logger    config                       target-registry
              │                               │
            storage                       compatibility
              │                               │
         queue-manager / artifact-manager / project-model
              │
        toolchain-manager
              │
        build-orchestrator
              │
   ┌──────────┴──────────┐
   │                     │
 apps/cli            apps/web (REST + SSE)
                         │
                    apps/desktop (Electron)
```

**架构纪律**：

- `core` 不聚合业务包，仅放无副作用基础（Result / 路径 / 类型 / sleep）
- 业务包不反向依赖应用层
- 每个包暴露明确 `index.ts` 契约，禁止跨包 `../` 相对路径
- `storage`、`toolchain-manager`、`build-orchestrator` 不泄漏实现细节
- 所有路径必经 `resolveInsideBase(base, input)`
- 所有外部命令执行恒为 `{ executable, args[], cwd, env }` + `spawn(..., { shell: false })`，**永不**拼接 shell

## 4. 模式 (mode) 与默认目录

| Mode | 触发 | workspace | cache | db |
|------|------|-----------|-------|-----|
| cli | CLI 启动 | 用户数据目录 | 用户缓存目录 | 用户数据目录 / db |
| web | `MC_FORGELAB_MODE=web` | 同上 | 同上 | 同上 |
| desktop | Electron 启动 | 同上（系统标准） | 同上 | 同上 |
| docker | `MC_FORGELAB_MODE=docker` | /data/workspace | /data/cache | /data/db/mc-forgelab.sqlite |

详见 [configuration.md](configuration.md)。

## 5. 安全模型摘要

- **路径**：`resolveInsideBase` 沙箱，拒绝 `..` / 绝对路径 / 控制字符 / Windows 保留名
- **命令**：参数数组化，`shell: false`，env 显式注入 JAVA_HOME / GRADLE_USER_HOME / Maven local repo
- **PATH 隔离**：构建时不继承系统 PATH，使用 toolchain-manager 返回的绝对路径
- **下载**：仅 `workspace/artifacts` 与 project dist 允许区可下载，校验 projectId / artifactId
- **认证**：默认 disabled（本地友好），HTTPS BASE_URL 或公网部署时启动提示
- **合规**：不内置盗版服务端，不绕授权，不实现恶意功能

详见 [security.md](security.md)。

## 6. 阶段路线

详见 [roadmap.md](roadmap.md)。阶段 1 = 当前仓库已实现的基础架构。
