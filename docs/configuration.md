# 配置与环境变量

所有环境变量以 `MC_FORGELAB_` 前缀。优先级：**环境变量 > JSON 配置文件（阶段 6+） > 默认值**。

## 核心

| 变量 | 默认 | 说明 |
|------|------|------|
| `MC_FORGELAB_MODE` | `cli` | `cli` / `web` / `desktop` / `docker` |
| `MC_FORGELAB_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |

## 路径

| 变量 | Windows 默认 | macOS 默认 | Linux 默认 | Docker 默认 |
|------|-------------|-----------|-----------|-------------|
| `MC_FORGELAB_WORKSPACE` | `%LOCALAPPDATA%\MC-ForgeLab\workspace` | `~/Library/Application Support/MC-ForgeLab/workspace` | `~/.local/share/mc-forgelab/workspace` | `/data/workspace` |
| `MC_FORGELAB_CACHE` | `%LOCALAPPDATA%\MC-ForgeLab\cache` | `~/Library/Caches/MC-ForgeLab` | `~/.cache/mc-forgelab` | `/data/cache` |
| `MC_FORGELAB_LOGS` | `%LOCALAPPDATA%\MC-ForgeLab\logs` | `…/MC-ForgeLab/logs` | `~/.local/share/mc-forgelab/logs` | `/data/logs` |
| `MC_FORGELAB_DB` | `…\db\mc-forgelab.sqlite` | `…/db/mc-forgelab.sqlite` | `~/.local/share/mc-forgelab/db/mc-forgelab.sqlite` | `/data/db/mc-forgelab.sqlite` |
| `MC_FORGELAB_TOOLCHAINS` | `…\toolchains` | `…/toolchains` | `~/.local/share/mc-forgelab/toolchains` | `/opt/mc-forgelab/toolchains` |
| `MC_FORGELAB_ARTIFACTS` | `…\artifacts` | `…/artifacts` | `~/.local/share/mc-forgelab/artifacts` | `/data/artifacts` |

## Web/Server (阶段 3+)

| 变量 | 默认 | 说明 |
|------|------|------|
| `MC_FORGELAB_HOST` | `127.0.0.1` | 绑定地址 |
| `MC_FORGELAB_PORT` | `3000` | 端口 |
| `MC_FORGELAB_BASE_URL` | `null` | 外部访问 URL（反代必填）|

## 认证与限制（阶段 6+）

| 变量 | 默认 | 说明 |
|------|------|------|
| `MC_FORGELAB_AUTH_ENABLED` | `false` | 启用登录 |
| `MC_FORGELAB_ADMIN_USER` | – | 管理员用户名 |
| `MC_FORGELAB_ADMIN_PASSWORD` | – | 明文密码（启动后哈希入 db，不存原始）|
| `MC_FORGELAB_MAX_UPLOAD_SIZE` | `200MB` | 上传上限（接受 `KB/MB/GB`）|
| `MC_FORGELAB_MAX_PROJECT_SIZE` | `2GB` | 项目大小上限 |
| `MC_FORGELAB_MAX_BUILD_CONCURRENCY` | `1` | 同时构建任务数 |
| `MC_FORGELAB_ARTIFACT_RETENTION_DAYS` | `30` | 产物保留天数 |
| `MC_FORGELAB_MAX_ARTIFACT_STORAGE` | `20GB` | 产物总占用上限 |

## 解析规则

- **布尔**：`1` / `true` / `yes` / `on` 为真；`0` / `false` / `no` / `off` / 空字符串 为假；其他抛 `MCF_CONFIG_INVALID_VALUE`
- **尺寸**：支持 `B` / `KB` / `MB` / `GB` / `TB`，纯数字按字节
- **整数**：`^-?\d+$`，否则抛错
- **未知 mode/log level**：抛错

## CLI 验证

```bash
mcforgelab doctor          # 显示所有解析后路径与配置
mcforgelab doctor --json   # JSON 输出
```
