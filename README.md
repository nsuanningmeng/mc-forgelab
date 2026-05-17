# MC-ForgeLab

> Minecraft 插件、模组、混合端项目的**生成—编译—打包—下载**一体化平台。
> 四端可用：Windows / macOS / Linux / Docker。

## 项目状态

**当前阶段：阶段 1（基础架构）**

本仓库实现了：

- ✅ pnpm + turbo monorepo 工程骨架
- ✅ `packages/core`、`app-error`、`logger`、`config`、`storage`、`target-registry`、`compatibility`
- ✅ `apps/cli` 提供 `mcforgelab doctor` 与 `mcforgelab target list`
- 🚧 后续阶段（toolchain / template / build / artifact / WebUI / Docker / Electron）见 `docs/roadmap.md`

## 快速开始

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build

# CLI 验收
pnpm cli doctor
pnpm cli target list
pnpm cli target list --json
```

## 目录结构

```
apps/         应用层（cli / web / desktop）
packages/     业务包（core / app-error / logger / config / storage / target-registry / compatibility / 其余占位）
docs/         总体设计文档与 UI 蓝图
schemas/      JSON Schema（项目配置）
contracts/    跨语言契约（SSE 事件等）
docker/       Docker 构建骨架（阶段 7 实现）
tests/        跨包集成测试占位
```

## 核心设计文档

- [docs/architecture.md](docs/architecture.md) — 总体架构
- [docs/data-model.md](docs/data-model.md) — SQLite 模型
- [docs/api.md](docs/api.md) — REST API（含 SSE 构建日志流）
- [docs/roadmap.md](docs/roadmap.md) — 10 阶段路线
- [docs/security.md](docs/security.md) — 安全模型与合规边界
- [docs/configuration.md](docs/configuration.md) — 环境变量与默认目录
- [docs/cli-ux.md](docs/cli-ux.md) — CLI 体验规范
- [docs/electron.md](docs/electron.md) — 桌面端架构
- [docs/ui-blueprint/](docs/ui-blueprint/) — WebUI 8 页面蓝图

## 合规边界

本工具**不**：

- 内置盗版 Minecraft 服务端 jar
- 绕过 Mojang 正版验证
- 提供后门 / 盗号 / DDoS / 绕授权 / 恶意插件能力

详见 [docs/security.md](docs/security.md)。

## License

Apache-2.0
