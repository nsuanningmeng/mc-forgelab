# CLI 用户体验规范

## 命令树（阶段全景）

```
mcforgelab
├── doctor                            ✅ 阶段 1
│   ├── toolchains                    🚧 阶段 2
│   └── network                       🚧 阶段 2
├── target
│   ├── list [--type] [--all] [--json]   ✅ 阶段 1
│   └── show <id> [--json]               ✅ 阶段 1
├── create [--interactive | --spec <json>]    🚧 阶段 4
├── build <projectId> [--clean]               🚧 阶段 5
├── package <projectId>                       🚧 阶段 5
├── toolchain
│   ├── list                                  🚧 阶段 2
│   ├── install java --version 17             🚧 阶段 2
│   └── verify                                🚧 阶段 2
└── cache
    ├── status                                🚧 阶段 6
    └── clean                                 🚧 阶段 6
```

## 输出风格

- **默认：** 表格 + 彩色（picocolors）；尽量在 80 字符宽屏可读
- **`--json`：** 所有命令统一支持，输出可被 `jq` 直接消费
- **状态符号：** `OK` / `WARN` / `MISS` / `INFO`（终端不支持颜色时降级为纯文本）
- **错误：** stderr 红色 `✗` 前缀 + `[ERROR_CODE]` + `messageZh` + 建议（如有）

## 退出码

| 码 | 含义 |
|---|------|
| 0 | 成功 / help / version |
| 1 | 命令用法错误（commander 异常） |
| 2 | AppError（带 code，可程序化处理） |
| 3 | 未知内部错误（栈打印到 stderr） |

## Windows 兼容

- 中文路径与空格路径支持（路径始终引号）
- PowerShell / cmd 均可运行
- Unicode 符号在旧终端自动降级（picocolors 自动检测）
- bat / cmd 脚本可调用 `node bin/mcforgelab.mjs`

## macOS / Linux 兼容

- zsh / bash / fish 均可
- 终端宽度 < 100 时表格自动 wrap
- 退出码遵循 POSIX 约定

## 交互式 (阶段 4 起)

`mcforgelab create` 默认进入 enquirer 交互流程：

1. 项目名 → 自动派生 slug（用户可改写）
2. target 选择（从 `target list` 派生）
3. MC 版本（按 target 过滤）
4. Java 版本（按 MC + target 推荐 + 候选）
5. 构建工具（按 target 推荐）
6. 包名（基于项目名预填）
7. 特性勾选（features）
8. 兼容性预检：实时显示 warnings / errors；blocking 时禁用"创建"

## 非交互（自动化）

```bash
mcforgelab create --spec ./spec.json
mcforgelab build <projectId> --command build
mcforgelab create --json | jq .id
```

`--spec` 文件遵循 `schemas/project.schema.json`。

## doctor 输出示例

```
┌──────────────────────────┬──────┬─────────────────────────────────────────────────────────────┐
│ 项目                     │ 状态 │ 详情                                                        │
├──────────────────────────┼──────┼─────────────────────────────────────────────────────────────┤
│ 操作系统 / OS            │  OK  │ win32 (x64) node v20.18.0                                   │
│ 运行模式 / mode          │  OK  │ cli                                                         │
│ workspace 路径           │  OK  │ C:\Users\u\AppData\Local\MC-ForgeLab\workspace              │
│ JDK                      │ MISS │ 阶段 2 实现 / detected at stage 2                           │
│ target registry          │  OK  │ v1.0.0 (3 内置 target)                                      │
│ compatibility registry   │  OK  │ v1.0.0 (7 内置规则)                                         │
└──────────────────────────┴──────┴─────────────────────────────────────────────────────────────┘
```
