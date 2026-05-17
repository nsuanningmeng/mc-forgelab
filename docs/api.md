# REST API 设计（阶段 3 起实施）

所有 API 前缀 `/api`，JSON 请求/响应（除下载流外），ISO8601 时间戳，UTF-8。错误响应统一使用 `AppErrorJson` 结构。

## 通用错误响应

```json
{
  "name": "AppError",
  "code": "MCF_API_NOT_FOUND",
  "httpStatus": 404,
  "severity": "error",
  "messageZh": "资源不存在。",
  "messageEn": "Resource not found.",
  "fixSuggestionZh": "...",
  "fixSuggestionEn": "...",
  "details": { "..." : "..." }
}
```

## 项目 API

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| GET | /api/projects | 3 | 列出全部项目 |
| GET | /api/projects/:projectId | 3 | 单个项目详情 |
| POST | /api/projects | 3 | 创建项目（需通过 compatibility check） |
| DELETE | /api/projects/:projectId | 3 | 删除项目（级联 builds/artifacts）|
| GET | /api/projects/:projectId/tree | 4 | 项目文件树（用于详情页）|

### POST /api/projects 请求体

```json
{
  "spec": {
    "name": "MyAwesomePlugin",
    "slug": "my-awesome-plugin",
    "type": "plugin",
    "targetId": "paper",
    "minecraftVersion": "1.20.4",
    "javaVersion": 17,
    "buildTool": "gradle",
    "packageName": "com.example.myplugin",
    "mainClass": "com.example.myplugin.Main",
    "author": "Alice",
    "version": "0.1.0",
    "features": { "enableCommand": true }
  }
}
```

响应 201：`{ "project": ProjectRecord, "compatibilityResults": CheckResult[] }`。

阻断性兼容性错误（blocking=true）→ 422 `MCF_COMPAT_BLOCKING`，附 `details.results`。

## 构建 API

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| POST | /api/projects/:projectId/build | 5 | 提交构建（默认 `command=build`，进 queue）|
| POST | /api/projects/:projectId/builds/:buildId/cancel | 5 | 取消 queued / running 构建 |
| GET | /api/projects/:projectId/builds | 5 | 构建列表 |
| GET | /api/projects/:projectId/builds/:buildId | 5 | 单条构建详情 |
| GET | /api/projects/:projectId/builds/:buildId/logs | 5 | 完整 build.log 文本流 |
| GET | /api/projects/:projectId/builds/:buildId/stream | 5 | SSE 实时日志 |

### SSE 事件流（详见 contracts/build-event.ts）

```
event: build.progress
data: {"stage":"compile","percent":42}

event: build.log
data: {"line":"> Task :compileJava\n","stream":"stdout","ts":"..."}

event: build.compat
data: {"code":"NMS_VERSION_LOCK","level":"warning","messageZh":"..."}

event: build.error
data: {"code":"MCF_BUILD_FAILED","summary":"..."}

event: build.done
data: {"status":"success","artifacts":["..."]}
```

支持 `Last-Event-ID` 头实现断线重连（阶段 5+）。

## 产物 API

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| GET | /api/projects/:projectId/artifacts | 6 | 项目产物列表 |
| GET | /api/projects/:projectId/artifacts/:artifactId/download | 6 | **流式下载**，校验路径，限制 workspace/artifacts |
| DELETE | /api/projects/:projectId/artifacts/:artifactId | 6 | 删除产物 |
| POST | /api/projects/:projectId/download-source | 6 | 异步生成源码 zip，返回 artifactId |

### 下载响应头

```
Content-Type: application/java-archive    (或 application/zip / application/json / text/plain)
Content-Disposition: attachment; filename*=UTF-8''<percent-encoded>
Content-Length: <size>
X-Artifact-Sha256: <sha256>
```

**安全要求**：
- 所有用户路径走 `resolveInsideBase`
- 文件不存在 → 404 `MCF_ARTIFACT_NOT_FOUND`
- 大文件用 stream pipeline，禁止 `fs.readFileSync` 阻塞 event loop

## 工具链 API

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| GET | /api/toolchains | 2 | 已安装工具链列表 |
| POST | /api/toolchains/install | 2 | 安装指定工具链（异步任务）|
| POST | /api/toolchains/verify | 2 | 校验 sha256 / 完整性 |
| GET | /api/toolchains/doctor | 2 | 诊断（含 OS / arch / 已安装 / 缺失）|

## 缓存 API

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| GET | /api/cache/status | 6 | 缓存占用统计 |
| POST | /api/cache/clean | 6 | 清理缓存（可选 dryRun）|

## 健康检查

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| GET | /api/health | 3 | `{ "status":"ok", "version":"0.1.0", "uptime": 12345 }` |

## 反向代理兼容

- 信任 `X-Forwarded-For` 与 `X-Forwarded-Proto`
- `MC_FORGELAB_BASE_URL` 用于生成绝对链接
- SSE 必需 `proxy_buffering off`（见 docs/nginx-example.conf）
- 流式下载禁用一次性缓冲
