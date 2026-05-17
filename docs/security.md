# Security

## API Key 保护

- API Key 使用 AES-256-GCM 加密存储在本地数据库
- 日志中只显示前 4 位和后 4 位（`sk-ab...xy12`）
- 前端 API 不返回完整 API Key
- **不要将 API Key 提交到 Git**

## .env 不得提交

- `.env` 和 `.env.*` 已在 `.gitignore` 中排除
- 使用 `.env.example` 作为模板，填写真实值后保存为 `.env`

## 文件操作沙箱

- AI 生成的 FilePatch 只能操作 workspace 内的文件
- 使用 `resolveInsideBase` + `realpathSync` 双重路径校验
- 禁止路径穿越（`../`）和绝对路径
- 遍历时跳过 symlink

## 路径穿越防护

所有文件操作在执行前验证：路径不包含 `..` 段，`realpathSync` 解析后的真实路径仍在允许目录内。

## 构建命令执行安全

- 使用 `spawn(executable, args[], { shell: false })`，禁止拼接 shell 字符串
- 构建进程 env 白名单隔离，不继承宿主 `process.env`
- 工作目录限制在 workspace 内

## Docker WebUI 公网部署风险

默认配置 `MC_FORGELAB_AUTH_ENABLED=false` 仅适合本地/内网使用。

**公网部署必须：**
1. 设置 `MC_FORGELAB_AUTH_ENABLED=true` 和强密码
2. 配置 HTTPS（Nginx/Caddy 反向代理）

## AI 生成代码的安全审查建议

- AI 生成的代码在应用前经过 `validatePatch` 校验
- 建议在生产服务器部署前人工审查 AI 生成的插件代码

## 如何报告安全问题

请发送邮件至 **security@example.com**，不要通过公开 Issue 提交漏洞细节。详见 [SECURITY.md](../SECURITY.md)。
