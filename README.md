# MC-AI-ForgeLab

**AI-powered Minecraft plugin and mod development platform.**

MC-AI-ForgeLab 是一个 AI 驱动的 Minecraft 插件/模组自动开发平台，目标是让用户通过自然语言描述需求，由 AI 自动规划、编写代码、编译、修错、打包并导出 jar 和源码包。

## 核心特性规划

- OpenAI Compatible 第三方 API 接入，支持自定义 baseUrl / apiKey / model
- AI 自然语言开发插件/模组（单模型快速模式 / 多模型工作流模式）
- 自动生成项目结构、自动编译、自动分析构建错误、自动修复代码
- Docker WebUI / Windows / macOS / Linux 桌面端 / CLI
- jar / source.zip / build.log / manifest.json 下载
- Paper / Fabric / Velocity / Forge / NeoForge / Quilt 等目标端逐步支持

## 当前状态

项目处于**早期开发阶段**，API、架构和数据模型可能变化。欢迎贡献 target registry、compatibility registry、模板、文档和测试。

## 快速开始

```bash
# Docker WebUI
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
# 浏览器打开 http://localhost:3000
```

```bash
# 开发模式
cp .env.example .env
pnpm install
pnpm --filter @mc-forgelab/web dev
```

> **重要**：不要将 `.env` 提交到 Git。`.env` 已在 `.gitignore` 中排除。

## 安全声明

- 本项目不提供恶意插件生成能力，不提供盗号、后门、绕授权、绕正版验证、攻击服务器功能
- AI 文件操作限制在 workspace 内，禁止路径穿越
- API Key 不应提交到 Git，不应写入日志
- Docker WebUI 暴露公网时必须开启认证（`MC_FORGELAB_AUTH_ENABLED=true`）和 HTTPS

## 许可证

本项目采用 **[AGPL-3.0-only](LICENSE)** 开源。

- 你可以自由使用、学习、修改、分发本项目
- 如果你修改本项目并作为**网络服务**提供给用户，需遵守 AGPL 对应的源码提供义务
- 详见 [docs/licensing.md](docs/licensing.md)

## 免责声明

- Minecraft 是 Mojang/Microsoft 的注册商标，本项目与 Mojang/Microsoft 无关
- 本项目不分发 Minecraft 客户端或服务端 jar，不绕过正版验证
- 用户需自行遵守 Minecraft EULA、服务器规则及第三方 API 服务条款
- 详见 [TRADEMARKS.md](TRADEMARKS.md)
