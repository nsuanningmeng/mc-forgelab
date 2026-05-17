# 新建项目向导

## 核心目标
4 步表单，**兼容性检查必须在向导中显式呈现**，blocking 错误阻止 "创建"。

## 步骤

1. **基础信息**：项目名 / slug / 包名 / 作者 / 描述
2. **目标端**：从 target-registry 选择（Paper / Fabric / Velocity / 阶段 9+ 更多）
3. **版本与构建**：MC 版本 → Java 版本（推荐高亮）→ 构建工具
4. **功能与确认**：features 勾选 + 兼容性预检 + 创建

## 线框（步骤 3 + 兼容性提示）

```
┌─────────────────────────────────────────────────────────────────┐
│  新建项目                                Step 3 / 4             │
├─────────────────────────────────────────────────────────────────┤
│  Minecraft 版本                                                  │
│  ( ) 1.20.1   ( ) 1.20.4   (●) 1.20.6   ( ) 1.21.1              │
│                                                                  │
│  Java 版本                                                       │
│  ( ) 17 (不推荐)    (●) 21 (推荐)                               │
│                                                                  │
│  构建工具                                                        │
│  (●) Gradle (Kotlin DSL)    ( ) Maven                           │
│                                                                  │
├─ 兼容性预检 ────────────────────────────────────────────────────┤
│  ⓘ Minecraft 1.20.6 推荐使用 Java 21。                          │
│  ⚠ 使用 NMS 会强绑定小版本，升级需重新构建。                    │
│  ✓ Paper 1.20.6 + Java 21 是稳定组合。                          │
└─────────────────────────────────────────────────────────────────┘
[ 上一步 ]                                       [ 下一步 ]
```

## 兼容性 UI 规则

| 级别 | 颜色 | 图标 | 行为 |
|------|------|------|------|
| info | 灰 | ⓘ | 折叠显示，可展开 |
| warning | 黄 | ⚠ | 默认展开，不阻止操作 |
| error (blocking=false) | 红 | ✗ | 默认展开，**不阻止** |
| error (blocking=true) | 红粗 | 🚫 | 顶部 Alert + 禁用"创建"按钮 |

## 实时重算

```ts
useEffect(() => {
  const ctx = { targetId, minecraftVersion, javaVersion, gradleVersion, ... };
  api.post("/api/compatibility/check", ctx).then(setCheckResults);
}, [targetId, minecraftVersion, javaVersion, gradleVersion, usesNms, usesMixin]);
```

- 输入改变 → 200ms debounce → 调用 compatibility check
- 结果分组：error → warning → info
- "创建" 按钮 disabled 当 `hasBlocking`

## 步骤 4：确认 + 创建

```
确认创建：
├─ MyAwesomePlugin
│  com.example.myawesomeplugin
│  Paper · MC 1.20.6 · Java 21 · Gradle Kotlin DSL
├─ 功能：命令 / 监听器 / 配置文件
└─ ⚠ 1 项警告（NMS 版本锁定）

[ 上一步 ]      [ 取消 ]            [ 创建项目 ]
```

成功 → 跳转 `/projects/:id`，弹 toast "项目已创建"。
失败 → 顶部 Alert 显示 `[ERROR_CODE] messageZh`。

## 移动端

阶段 10 再支持；当前最小宽度 1024px。
