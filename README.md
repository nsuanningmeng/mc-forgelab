<div align="center">

# MC-ForgeLab

**AI-powered Minecraft plugin & mod development platform**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.18-green.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.12.0-orange.svg)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)
[![Early Development](https://img.shields.io/badge/Status-Early%20Development-yellow.svg)](#roadmap)

[English](#english) · [中文](#中文)

</div>

---

<a name="english"></a>

## English

### What is MC-ForgeLab?

MC-ForgeLab is an AI-driven platform that takes a natural-language description of a Minecraft plugin or mod and delivers a compiled, packaged, ready-to-deploy `.jar` — no Java, Gradle, Maven, or build toolchain knowledge required.

**Full loop:** describe → AI generates code → auto-compile → auto-fix errors (up to 5 rounds) → package → download.

### Features

| Category | Details |
|---|---|
| **AI Providers** | Any OpenAI-compatible API — custom `baseUrl`, `apiKey`, model selection |
| **Workflow Modes** | Single-model fast mode · Multi-model collaborative workflow |
| **Build Targets** | Paper · Fabric · Velocity · Forge · NeoForge · Quilt |
| **Auto-Fix** | Compiler error analysis → AI patch → rebuild loop (≤5 rounds) |
| **Artifacts** | `.jar` · `source.zip` · `build.log` · `manifest.json` with SHA-256 |
| **Interfaces** | Docker WebUI · Desktop (Win/macOS/Linux) · CLI |
| **Knowledge Base** | Built-in Minecraft dev knowledge injected into AI context |
| **Security** | Path sandbox · shell-injection-free command execution · API key masking |

### Quick Start

**Docker (recommended)**

```bash
cp docker-compose.example.yml docker-compose.yml
# Edit docker-compose.yml — set your AI provider key
docker compose up -d
# Open http://localhost:3000
```

**Development mode**

```bash
cp .env.example .env          # fill in your API key
pnpm install
pnpm --filter @mc-forgelab/web dev
```

**CLI**

```bash
pnpm cli doctor               # verify environment
pnpm cli doctor --json        # JSON output
```

> Never commit `.env` to Git. It is already in `.gitignore`.

### Architecture

```
core
 └── app-error
      ├── logger
      ├── config
      │    └── storage
      │         ├── queue-manager
      │         ├── artifact-manager
      │         └── project-model
      └── target-registry
           └── compatibility
                └── toolchain-manager
                     └── build-orchestrator
                          ├── apps/cli
                          └── apps/web  ──→  apps/desktop (Electron)
```

Key constraints:
- `core` holds only side-effect-free primitives (Result type, path utils, sleep)
- All user-supplied paths pass through `resolveInsideBase()` — no `..` traversal
- All external commands use `spawn(file, args[], { shell: false })` — no shell string concatenation
- Packages expose only their `index.ts` contract; no cross-package `../` imports

### Configuration

All environment variables use the `MC_FORGELAB_` prefix. Priority: **env var > JSON config file > default**.

| Variable | Default | Description |
|---|---|---|
| `MC_FORGELAB_MODE` | `cli` | `cli` / `web` / `desktop` / `docker` |
| `MC_FORGELAB_HOST` | `127.0.0.1` | Bind address |
| `MC_FORGELAB_PORT` | `3000` | HTTP port |
| `MC_FORGELAB_AUTH_ENABLED` | `false` | Enable login (required for public deployments) |
| `MC_FORGELAB_ADMIN_USER` | — | Admin username |
| `MC_FORGELAB_ADMIN_PASSWORD` | — | Admin password (hashed on first start) |
| `MC_FORGELAB_MAX_BUILD_CONCURRENCY` | `1` | Parallel build jobs |
| `MC_FORGELAB_ARTIFACT_RETENTION_DAYS` | `30` | Artifact retention period |

Full reference: [docs/configuration.md](docs/configuration.md)

### Roadmap

| Stage | Status | Description |
|---|---|---|
| 1 | ✅ | Monorepo · TypeScript strict · logger · config · SQLite · Fastify API · CLI |
| 2 | ✅ | OpenAI-compatible provider · API key storage · model profiles |
| 3 | ✅ | AI workflow engine · single/multi-model · SSE streaming |
| 4 | ✅ | Paper plugin generation end-to-end |
| 5 | ✅ | Toolchain manager · build orchestrator · auto-fix loop |
| 6 | ✅ | Artifact download center · SHA-256 · streaming |
| 7 | ✅ | Docker WebUI · React frontend · multi-stage Dockerfile |
| 8 | ✅ | Fabric · Velocity · Forge · NeoForge · Quilt templates · Electron skeleton |
| 9 | ✅ | Built-in knowledge base · keyword retrieval · AI context injection |
| 10 | 🔜 | Vector RAG · workflow visual editor · template marketplace · test server runner |

### Security

- AI file operations are sandboxed to `workspace/` — path traversal is rejected at the API boundary
- All subprocess execution uses argument arrays with `shell: false`
- API keys are masked in logs and never written to disk in plaintext
- Public deployments **must** set `MC_FORGELAB_AUTH_ENABLED=true` and use HTTPS
- This platform does not generate malicious plugins, backdoors, auth bypasses, or cracked-server tooling

Full policy: [docs/security.md](docs/security.md) · [SECURITY.md](SECURITY.md)

### Contributing

Contributions welcome — especially build target implementations, compatibility data, templates, and tests. See [CONTRIBUTING.md](CONTRIBUTING.md).

> This project is in early development. APIs, schemas, and data models may change without notice.

### License

[AGPL-3.0-only](LICENSE). If you modify this project and offer it as a network service, you must make the corresponding source available to your users. See [docs/licensing.md](docs/licensing.md).

### Disclaimer

Minecraft is a trademark of Mojang/Microsoft. This project is not affiliated with or endorsed by Mojang or Microsoft. No Minecraft client or server JARs are distributed. Users are responsible for complying with the Minecraft EULA, server rules, and third-party API terms of service. See [TRADEMARKS.md](TRADEMARKS.md).

---

<a name="中文"></a>

## 中文

### 项目简介

MC-ForgeLab 是一个 AI 驱动的 Minecraft 插件/模组开发平台。用户用自然语言描述需求，平台自动完成代码生成、编译、错误修复、打包，最终输出可直接部署的 `.jar` 文件——无需掌握 Java、Gradle、Maven 或任何构建工具链。

**完整闭环：** 描述需求 → AI 生成代码 → 自动编译 → 自动修错（最多 5 轮）→ 打包 → 下载。

### 核心特性

| 类别 | 详情 |
|---|---|
| **AI 接入** | 任意 OpenAI 兼容 API，支持自定义 `baseUrl`、`apiKey`、模型选择 |
| **工作流模式** | 单模型快速模式 · 多模型协作工作流 |
| **构建目标** | Paper · Fabric · Velocity · Forge · NeoForge · Quilt |
| **自动修错** | 编译错误分析 → AI 补丁 → 重新构建（≤5 轮） |
| **产物下载** | `.jar` · `source.zip` · `build.log` · `manifest.json`，含 SHA-256 |
| **使用界面** | Docker WebUI · 桌面端（Win/macOS/Linux）· CLI |
| **知识库** | 内置 Minecraft 开发知识，自动注入 AI 上下文 |
| **安全** | 路径沙箱 · 无 shell 注入命令执行 · API Key 脱敏 |

### 快速开始

**Docker（推荐）**

```bash
cp docker-compose.example.yml docker-compose.yml
# 编辑 docker-compose.yml，填入 AI 提供商的 API Key
docker compose up -d
# 浏览器打开 http://localhost:3000
```

**开发模式**

```bash
cp .env.example .env          # 填入 API Key
pnpm install
pnpm --filter @mc-forgelab/web dev
```

**CLI**

```bash
pnpm cli doctor               # 检查环境配置
pnpm cli doctor --json        # JSON 格式输出
```

> 不要将 `.env` 提交到 Git，`.gitignore` 已排除该文件。

### 架构概览

```
core
 └── app-error
      ├── logger
      ├── config
      │    └── storage
      │         ├── queue-manager
      │         ├── artifact-manager
      │         └── project-model
      └── target-registry
           └── compatibility
                └── toolchain-manager
                     └── build-orchestrator
                          ├── apps/cli
                          └── apps/web  ──→  apps/desktop (Electron)
```

架构纪律：
- `core` 仅放无副作用基础类型（Result、路径工具、sleep），不聚合业务包
- 所有用户路径必经 `resolveInsideBase()` 沙箱，拒绝 `..` 穿越
- 所有外部命令使用参数数组 + `spawn(..., { shell: false })`，永不拼接 shell 字符串
- 包间通过 `index.ts` 契约通信，禁止跨包 `../` 相对路径

### 配置说明

所有环境变量使用 `MC_FORGELAB_` 前缀。优先级：**环境变量 > JSON 配置文件 > 默认值**。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MC_FORGELAB_MODE` | `cli` | 运行模式：`cli` / `web` / `desktop` / `docker` |
| `MC_FORGELAB_HOST` | `127.0.0.1` | 绑定地址 |
| `MC_FORGELAB_PORT` | `3000` | HTTP 端口 |
| `MC_FORGELAB_AUTH_ENABLED` | `false` | 启用登录（公网部署必须开启） |
| `MC_FORGELAB_ADMIN_USER` | — | 管理员用户名 |
| `MC_FORGELAB_ADMIN_PASSWORD` | — | 管理员密码（首次启动后哈希存储） |
| `MC_FORGELAB_MAX_BUILD_CONCURRENCY` | `1` | 最大并行构建任务数 |
| `MC_FORGELAB_ARTIFACT_RETENTION_DAYS` | `30` | 产物保留天数 |

完整配置参考：[docs/configuration.md](docs/configuration.md)

### 开发路线图

| 阶段 | 状态 | 内容 |
|---|---|---|
| 1 | ✅ | Monorepo · TypeScript strict · logger · config · SQLite · Fastify API · CLI |
| 2 | ✅ | OpenAI 兼容 Provider · API Key 脱敏存储 · 模型配置 |
| 3 | ✅ | AI 工作流引擎 · 单/多模型模式 · SSE 实时状态 |
| 4 | ✅ | Paper 插件生成完整闭环 |
| 5 | ✅ | Toolchain Manager · Build Orchestrator · 自动修错循环 |
| 6 | ✅ | 产物下载中心 · SHA-256 · 流式下载 |
| 7 | ✅ | Docker WebUI · React 前端 · 多阶段 Dockerfile |
| 8 | ✅ | Fabric · Velocity · Forge · NeoForge · Quilt 模板 · Electron 桌面端骨架 |
| 9 | ✅ | 内置知识库 · 关键字检索 · AI 上下文注入 |
| 10 | 🔜 | 向量 RAG · 工作流可视化编辑器 · 模板市场 · 测试服务器运行 |

### 安全声明

- AI 文件操作限制在 `workspace/` 沙箱内，路径穿越在 API 层直接拒绝
- 所有子进程调用使用参数数组 + `shell: false`，无 shell 注入风险
- API Key 在日志中脱敏，不以明文写入磁盘
- 公网部署**必须**开启 `MC_FORGELAB_AUTH_ENABLED=true` 并配置 HTTPS
- 本平台不生成恶意插件、后门、绕授权、绕正版验证或攻击服务器的功能

完整安全策略：[docs/security.md](docs/security.md) · [SECURITY.md](SECURITY.md)

### 参与贡献

欢迎贡献构建目标实现、兼容性数据、模板和测试。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

> 项目处于早期开发阶段，API、数据模型和架构可能在不通知的情况下变更。

### 许可证

[AGPL-3.0-only](LICENSE)。如果你修改本项目并作为网络服务提供给用户，需向用户提供对应的修改后源码。详见 [docs/licensing.md](docs/licensing.md)。

### 免责声明

Minecraft 是 Mojang/Microsoft 的注册商标，本项目与 Mojang/Microsoft 无关联，亦未获其背书。本项目不分发 Minecraft 客户端或服务端 JAR，不绕过正版验证。用户需自行遵守 Minecraft EULA、服务器规则及第三方 API 服务条款。详见 [TRADEMARKS.md](TRADEMARKS.md)。
