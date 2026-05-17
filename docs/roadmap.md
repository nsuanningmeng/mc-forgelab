# 10 阶段路线

| 阶段 | 标题 | 状态 | 关键交付物 |
|------|------|------|----------|
| 1 | 基础架构 | ✅ 已实施 | monorepo / core / app-error / logger / config / storage / target-registry / compatibility / CLI doctor & target list |
| 2 | Toolchain Manager | 🚧 待办 | JDK 8/11/17/21 检测与安装、Gradle/Maven 管理、manifest 校验 |
| 3 | Web API + 项目管理 | 🚧 待办 | Fastify 后端、SQLite projects 表、新建项目 API、WebUI 首页 |
| 4 | 模板生成 | 🚧 待办 | template-engine 实施、Paper/Fabric 模板、`mcforgelab create` |
| 5 | Build Orchestrator | 🚧 待办 | 构建队列、build API、Gradle/Maven 隔离调用、SSE 实时日志、cancel |
| 6 | Artifact 下载中心 | 🚧 待办 | artifact-manager、manifest.json、sha256、jar/zip/log 下载 |
| 7 | Docker WebUI | 🚧 待办 | Dockerfile / docker-compose.yml / 内置工具链 / /data 挂载 / 非 root |
| 8 | 桌面端封装 | 🚧 待办 | Electron + Win/macOS/Linux 打包、Full/Lite Bundle |
| 9 | 更多目标端 | 🚧 待办 | Velocity 完整支持、Forge、NeoForge、Quilt、Hybrid multi-module |
| 10 | 增强功能 | 🚧 待办 | 代理 / 镜像源 / 缓存清理 / 测试服务器 / 模板 marketplace / 兼容性数据库自更新 |

## 阶段 1 验收（当前仓库）

- 工程：pnpm + turbo monorepo，TypeScript strict 全开，vitest 单测
- 9 个 package + apps/cli 完整实现
- 7 个占位 package 暴露契约 stub（阶段 2-7 实施时填充）
- WebUI 蓝图与设计契约就绪供后续阶段直接使用
- 验收命令：`pnpm install && pnpm typecheck && pnpm test && pnpm build`，`mcforgelab doctor`，`mcforgelab target list`

## 闭环目标（阶段 1+3+4+5+6+7 完成后）

1. Docker 启动 WebUI（端口 3000）
2. 浏览器访问首页
3. 在向导中创建 Paper 1.20.4 / Java 17 插件项目
4. 点击构建 → SSE 实时日志
5. 构建成功生成 plugin.jar
6. 下载 plugin.jar / source.zip / build.log / manifest.json
7. `dist/manifest.json` 完整记录 sha256 与兼容性 warnings

## 非目标 / 明确放弃

- 不内置盗版 Minecraft 服务端 jar
- 不绕过 Mojang 正版验证
- 不提供后门 / 盗号 / DDoS / 绕授权 / 恶意插件能力
- 不承诺所有 MC 版本与所有 target 稳定支持（通过 compatibility registry 显式声明）
- 不支持自动安装 Minecraft 客户端
