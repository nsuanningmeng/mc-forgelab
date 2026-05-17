# Security Policy

## 报告安全问题

**请不要通过公开 Issue 提交严重漏洞细节。**

发现安全问题请发送邮件至：**security@example.com**

邮件请包含：
- 漏洞描述和影响范围
- 复现步骤
- 建议的修复方案（可选）

我们会在 72 小时内确认收到，并尽快评估和修复。

## 重点安全范围

| 类别 | 说明 |
|------|------|
| AI 文件操作越权 | AI 生成的 FilePatch 必须限制在 workspace 内 |
| 路径穿越 | `resolveInsideBase` + `realpathSync` 双重校验 |
| API Key 泄露 | 加密存储，日志脱敏，不暴露给前端 |
| Docker WebUI 未授权访问 | 公网部署必须启用 `MC_FORGELAB_AUTH_ENABLED=true` |
| 构建命令注入 | 使用 `spawn(file, args[], { shell: false })`，白名单 env |
| 下载接口越权 | artifact 归属校验，路径二次验证 |
| 日志泄密 | 日志不记录完整 API Key，不记录 Authorization header |

## 已知安全设计

- API Key 使用 AES-256-GCM 加密存储
- SSRF 防护：拒绝私有/回环 IP 的 AI Provider baseUrl
- 构建进程 env 白名单隔离
- symlink 跟随防护
- Content-Disposition header 注入防护
