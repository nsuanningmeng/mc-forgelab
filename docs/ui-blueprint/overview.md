# WebUI 信息架构总览

> 阶段 3+ 实施。本文档定义 8 个核心页面的顶级导航、路由、共用布局与设计原则。

## 顶级导航

```
┌────────────────────────────────────────────────────────────────────────┐
│  MC-ForgeLab    [  仪表盘  |  项目  |  下载中心  |  工具链  |  设置  ]  │
│                            🔔  ⚙   👤                                  │
├──────────────────┬─────────────────────────────────────────────────────┤
│                  │  面包屑 / 当前页面标题                              │
│  Sidebar         │                                                     │
│  - 仪表盘        │  ────────────────────────────────────────────────   │
│  - 项目          │  内容区域                                           │
│  - 下载中心      │                                                     │
│  - 工具链        │                                                     │
│  - 设置          │                                                     │
│                  │                                                     │
│  [  + 新建项目 ] │                                                     │
└──────────────────┴─────────────────────────────────────────────────────┘
```

## 路由表

| 路径 | 页面 | 文件 |
|------|------|------|
| `/` | 首页仪表盘 | dashboard.md |
| `/projects` | 项目列表 | project-list.md |
| `/projects/new` | 新建项目向导 | new-project-wizard.md |
| `/projects/:id` | 项目详情 | project-detail.md |
| `/projects/:id/builds/:buildId` | 构建页面 | build-page.md |
| `/downloads` | 下载中心 | download-center.md |
| `/toolchain` | 工具链管理 | toolchain.md |
| `/settings` | 设置 | settings.md |

## 共用组件

- **Sidebar**：折叠/展开、当前选中态、未读徽章
- **TopBar**：面包屑、运行环境健康状态、通知中心、用户菜单
- **StatusBadge**：success / failed / running / queued / canceled
- **CompatibilityAlert**：blocking error / warning / info（颜色 + icon + 双语切换）
- **DataTable**：排序、过滤、分页、空状态、加载骨架屏
- **LogViewer**：虚拟滚动 + ANSI 解析 + 复制 + 跳转错误行
- **Stepper**：用于新建向导
- **FilePicker**：本地路径选择（Electron 拦截）

## 状态层次

| 状态 | 来源 | 工具 |
|------|------|------|
| Server state | REST API + SSE | TanStack Query |
| UI state | 表单 / 折叠 / 模态 | Zustand |
| 设置状态 | localStorage + REST | TanStack Query (mutate) |

## 设计原则

1. **空状态优先**：所有列表/表格设计空状态，含 CTA
2. **错误友好**：never 仅给 "Network error"，必须给 `[ERROR_CODE] messageZh`
3. **可观测**：构建状态一眼可见，避免用户来回切页
4. **键盘可达**：所有操作支持键盘导航 + ARIA
5. **响应式**：桌面优先，最小宽度 1024px，移动端阶段 10 再支持
6. **i18n**：所有文案走 i18next，禁止硬编码
7. **深色优先**：默认深色主题，光色为可选；保证 4.5:1 对比度
