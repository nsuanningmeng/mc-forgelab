# 构建页面（含实时 SSE 日志）

## 核心目标
**用户在构建页面停留时间最长的页面**。必须：实时、清晰、可恢复、可下载。

## 线框

```
┌────────────────────────────────────────────────────────────────────┐
│  项目 / MyAwesomePlugin / 构建 #004     ● running  00:42           │
├────────────────────────────────────────────────────────────────────┤
│  ┌─ 阶段进度 ─────────────────────────────────────────────────┐    │
│  │  ✓ 1. 兼容性检查       3s                                   │    │
│  │  ✓ 2. 选择工具链       0.2s                                 │    │
│  │  ● 3. 编译             正在进行... ████████░░░░ 60%         │    │
│  │  ○ 4. 打包                                                  │    │
│  │  ○ 5. 计算 sha256                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ 实时日志 ─────────────────────────────────────────────────┐    │
│  │  > Task :compileJava                                        │    │
│  │  > Task :processResources                                   │    │
│  │  Note: Some input files use unchecked or unsafe operations. │    │
│  │  ...                                                        │    │
│  │  (virtual scroll - 10MB ok)                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  [ 取消 ]    [ 重新构建 ]                  [ 复制日志 ] [ 下载日志]│
└────────────────────────────────────────────────────────────────────┘
```

## SSE 接入

```ts
const stream = new EventSource(
  `/api/projects/${pid}/builds/${bid}/stream`,
  { withCredentials: true }
);

stream.addEventListener("build.log", (e) => {
  const { line, stream: src } = JSON.parse(e.data);
  appendToVirtualBuffer({ line, src });
});

stream.addEventListener("build.progress", (e) => {
  const { stage, percent } = JSON.parse(e.data);
  setStage(stage, percent);
});

stream.addEventListener("build.done", (e) => {
  setStatus(e.data.status);
  stream.close();
});

stream.onerror = () => reconnectWithLastEventId();
```

事件类型详见 [`contracts/build-event.ts`](../../contracts/build-event.ts)。

## 断线重连

- 客户端记录 `lastEventId`
- 重连时附加 `Last-Event-ID` 头
- 服务端从历史日志补发 buffered 事件
- UI 显示 "重新连接中..." banner，3 秒后消失

## 虚拟滚动（大日志）

- 使用 `@tanstack/react-virtual`
- 行高 18px（`JetBrains Mono` 14px）
- 每行 ANSI 颜色解析为 React 节点（缓存）
- 自动跟随底部，用户滚动后暂停跟随，按钮 "回到底部" 出现

## 失败时友好摘要

```
┌─ 构建失败 [MCF_BUILD_FAILED] ──────────────────────────────────┐
│  ❗ Java 编译错误（compileJava 任务）                          │
│                                                                │
│  src/main/java/.../Main.java:42                                │
│    error: cannot find symbol: variable foo                     │
│                                                                │
│  [ 复制错误 ]    [ 跳转至日志行 ]    [ 下载完整日志 ]         │
└────────────────────────────────────────────────────────────────┘
```

错误摘要由后端 `errorSummary` 提供（阶段 5 实现），前端只渲染。

## 历史构建

构建已完成时（success / failed / canceled）：
- 直接展示落盘日志（不开 SSE）
- "[ 重新构建 ]" 按钮可用，新建构建 → 跳转到新 buildId

## 取消

- `POST /api/.../builds/:id/cancel`
- 立即更新 UI 为 "canceling..."
- 后端确认后变 "canceled"
- 进程被 SIGTERM → 5s 后 SIGKILL，避免孤儿进程
