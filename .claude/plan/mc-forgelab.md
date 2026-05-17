# MC-ForgeLab 阶段 1 + 设计文档 实施计划

> 综合 Codex 后端架构分析与 Gemini 前端蓝图，作为本轮工作流的执行契约。

## 1. 总体技术决策（已与用户确认）

| 领域 | 选型 | 备注 |
|------|------|------|
| Monorepo | pnpm workspaces + turbo | 阶段 1 不引入 Nx |
| TS 构建 | tsc + project references | strict 全开 |
| 测试 | vitest workspace | 包级测试 + CLI smoke |
| Logger | pino (+ pino-pretty 开发态) | child logger，结构化 JSON |
| SQLite | better-sqlite3，通过 ESM adapter 隔离 | Docker 基础镜像选 Debian slim |
| CLI 框架 | commander + enquirer + cli-table3 + picocolors | doctor/target list |
| Config | 自研 ConfigLoader | env > json > default；MC_FORGELAB_* 优先 |
| AppError | 自研，含 messageZh/messageEn/code/httpStatus/severity/cause | 后续 UI 通过 errorCode 联动 i18next |
| 模块系统 | ESM-first，CJS native 隔离在 adapter | `createRequire` 包内使用 |
| UI 蓝图 (预留) | React 18 + Vite + Tailwind v3.4 + shadcn/ui + TanStack Query + Zustand + i18next | 阶段 3+ 实现 |
| 设计 token | Minecraft 草绿 #52A535 主色，深色优先 | docs/design/tokens.json |

## 2. 架构纪律（强制）

1. `core` 不聚合，仅放无副作用基础类型/工具；业务包不反向依赖应用层。
2. 所有用户路径必经 `resolveInsideBase(base, input)`，拒绝 `..` 与符号链接逃逸。
3. 命令执行恒为 `{ executable, args[], cwd, env }` + `spawn(file, args, { shell: false })`，永不拼接 shell 字符串。
4. 不污染系统 PATH；构建时 JAVA_HOME / GRADLE_USER_HOME / Maven local repo 显式注入。
5. AppError 含双语字段，禁止把原始异常信息直接吐给用户。
6. 包间依赖图（DAG）：`core ← app-error ← logger / config ← storage / target-registry ← compatibility ← build-orchestrator`。
7. 文件落地遵循单一职责（每文件 <250 行优先）。

## 3. 文件结构

```
mc-forgelab/
├── package.json                  # 根 workspace
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json            # strict + ESNext + bundler resolution
├── vitest.workspace.ts
├── .editorconfig
├── .gitignore
├── .npmrc                        # node-linker / strict-peer-dependencies
├── .nvmrc                        # 20.18
├── LICENSE                       # Apache-2.0
├── README.md                     # 双语
│
├── apps/
│   ├── cli/                      # 阶段 1 实施
│   │   ├── package.json          # bin: mcforgelab
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # runCli(argv, env): Promise<number>
│   │       ├── main.ts           # bin 入口
│   │       └── commands/
│   │           ├── doctor.ts
│   │           └── target-list.ts
│   ├── web/                      # 阶段 3+ 占位 stub
│   │   ├── package.json
│   │   └── README.md
│   └── desktop/                  # 阶段 8 占位 stub
│       ├── package.json
│       └── README.md
│
├── packages/                     # 阶段 1 实现 9 个，其余仅契约
│   ├── core/                     # ✅ 实现
│   ├── app-error/                # ✅ 实现
│   ├── logger/                   # ✅ 实现
│   ├── config/                   # ✅ 实现
│   ├── storage/                  # ✅ 实现 (SQLite 雏形)
│   ├── target-registry/          # ✅ 实现
│   ├── compatibility/            # ✅ 实现
│   ├── project-model/            # 🚧 仅契约 stub
│   ├── template-engine/          # 🚧 仅契约 stub
│   ├── toolchain-manager/        # 🚧 仅契约 stub
│   ├── build-orchestrator/       # 🚧 仅契约 stub
│   ├── artifact-manager/         # 🚧 仅契约 stub
│   ├── queue-manager/            # 🚧 仅契约 stub
│   └── auth/                     # 🚧 仅契约 stub
│
├── docs/
│   ├── architecture.md           # 总体技术方案 + DAG + 阶段拆解
│   ├── data-model.md             # SQLite 表 + 接口
│   ├── api.md                    # REST API 设计（含 SSE）
│   ├── roadmap.md                # 10 阶段路线
│   ├── security.md               # 路径穿越、命令执行、auth、合规边界
│   ├── configuration.md          # 全部环境变量与默认目录
│   ├── cli-ux.md                 # CLI 用户体验规范
│   ├── electron.md               # 桌面端架构与 Full/Lite 引导
│   ├── nginx-example.conf        # 反向代理示例
│   ├── design/
│   │   └── tokens.json           # 设计 token
│   └── ui-blueprint/
│       ├── overview.md           # 顶级导航 + 8 页面索引
│       ├── dashboard.md
│       ├── project-list.md
│       ├── new-project-wizard.md # 含兼容性 UX
│       ├── project-detail.md
│       ├── build-page.md         # SSE 设计
│       ├── download-center.md
│       ├── toolchain.md
│       └── settings.md
│
├── schemas/
│   └── project.schema.json       # ProjectSpec JSON Schema (Draft 2020-12)
│
├── contracts/
│   └── build-event.ts            # SSE 事件类型契约
│
├── docker/                       # 仅骨架
│   ├── Dockerfile.skeleton
│   └── docker-compose.skeleton.yml
│
└── tests/                        # 跨包集成测试预留
    └── .gitkeep
```

## 4. 阶段 1 子任务清单（按依赖序）

| # | 任务 | 关键文件 | 单测 |
|---|------|---------|------|
| 1 | Monorepo 根配置 | package.json / pnpm-workspace.yaml / turbo.json / tsconfig.base.json / vitest.workspace.ts | – |
| 2 | core | result.ts / types.ts / paths.ts | ✅ |
| 3 | app-error | codes.ts / app-error.ts | ✅ |
| 4 | logger | logger.ts / sinks.ts | ✅ |
| 5 | config | schema.ts / env.ts / loader.ts | ✅ |
| 6 | storage | storage.ts / sqlite-adapter.ts / migrations.ts | ✅ in-memory |
| 7 | target-registry | target.ts / builtin.ts / registry.ts | ✅ |
| 8 | compatibility | model.ts / rules.ts / engine.ts | ✅ ≥5 规则 |
| 9 | 阶段 2-7 packages 占位 | 各包 index.ts 仅导出接口 stub | – |
| 10 | apps/cli | main.ts / commands/{doctor,target-list}.ts | ✅ handler |
| 11 | apps/{web,desktop} 占位 | README + package.json | – |
| 12 | 设计文档集 | docs/**/*.md | – |
| 13 | 设计契约 | schemas/project.schema.json / contracts/build-event.ts / design/tokens.json / docker/*.skeleton | – |
| 14 | typecheck + test + build 验收 | pnpm install / typecheck / test / build / mcforgelab doctor | – |

预估总规模：**~2500 LOC**（代码 ~2100 + 文档 ~5000 词中文）。

## 5. CLI 验收命令

```bash
pnpm install
pnpm typecheck         # tsc -b 全部包
pnpm test              # vitest run，全部包测试
pnpm build             # tsc -b，产出 dist
pnpm --filter @mc-forgelab/cli start -- doctor
pnpm --filter @mc-forgelab/cli start -- target list
pnpm --filter @mc-forgelab/cli start -- target list --json
```

`doctor` 输出表格：

```
┌─────────────────┬──────────────────────────────────┐
│ 项目            │ 状态                             │
├─────────────────┼──────────────────────────────────┤
│ 操作系统        │ Windows 11 (x64)                 │
│ Node 运行时     │ v20.18.0  ✓                      │
│ workspace 路径  │ %LOCALAPPDATA%\MC-ForgeLab\...   │
│ cache 路径      │ %LOCALAPPDATA%\MC-ForgeLab\cache │
│ db 路径         │ ...mc-forgelab.sqlite            │
│ JDK             │ ❌ 未配置 (阶段 2 实现)          │
│ Gradle          │ ❌ 未配置 (阶段 2 实现)          │
│ Maven           │ ❌ 未配置 (阶段 2 实现)          │
│ Docker          │ ⚠ 阶段 7 集成                    │
│ target registry │ v1.0.0 (3 内置 target)           │
│ compat registry │ v1.0.0 (≥5 规则)                 │
└─────────────────┴──────────────────────────────────┘
```

## 6. 风险登记

1. **better-sqlite3 native build** — 阶段 1 在开发机使用 prebuilt；Docker 选 Debian slim。Electron 阶段 8 再处理 `electron-rebuild`。
2. **ESM/CJS 边界** — better-sqlite3 用法封装在 `sqlite-adapter.ts` 的 `createRequire`，对外纯 ESM。
3. **TS project references 配置陷阱** — `composite: true`、统一 `outDir: dist`、禁止跨包 `../` 相对路径。
4. **Windows 路径** — 全局走 `node:path` 与 `path.resolve`；测试用 cross-env 覆盖。
5. **i18n 错误信息** — 阶段 1 内联 zh/en；阶段 6 后迁错误目录。
6. **Docker Alpine 陷阱** — 不作为默认基础镜像，docker/Dockerfile.skeleton 注明 Debian slim。

## 7. 不在本轮范围

- 阶段 2: Toolchain Manager 实现
- 阶段 3-7: WebUI、模板生成、构建编排、artifact、Docker WebUI
- 阶段 8-10: Electron、扩展 target、增强功能
- 真实安装 / 下载 JDK / Gradle
- 任何运行时构建真实 Minecraft 项目的能力

## 8. 验收标准

- [ ] `pnpm install` 成功
- [ ] `pnpm typecheck` 0 错误（strict 全开）
- [ ] `pnpm test` 全部通过
- [ ] `pnpm build` 全部包 dist 输出
- [ ] `mcforgelab doctor` 表格化输出
- [ ] `mcforgelab target list` 列出 3 个内置 target
- [ ] `mcforgelab target list --json` 输出有效 JSON
- [ ] docs/ 完整，含 8 页面 UI 蓝图
- [ ] schemas/project.schema.json 通过 `ajv` 自校验
- [ ] contracts/build-event.ts 类型可被 import 不报错
