# Contributing to MC-AI-ForgeLab

欢迎贡献！以下类型的贡献特别受欢迎：

- **Target Registry**：新增或完善 Minecraft 目标端定义
- **Compatibility Registry**：版本兼容性规则
- **插件/模组模板**：Paper / Fabric / Velocity / Forge / NeoForge / Quilt 模板
- **文档**：中英文文档改进
- **测试**：单元测试、集成测试
- **Bug 修复**：修复已知问题
- **UI 改进**：WebUI / CLI 体验优化

## 贡献协议

提交 Pull Request 即表示你确认：

- 贡献到本仓库的代码将按照 **AGPL-3.0-only** 发布
- 你有权贡献这些代码（不包含他人版权、商业授权限制或保密义务）
- 不要提交你无权开源的商业代码、私有代码或受限制代码

## 禁止提交的内容

- API Key、密钥、token
- `.env` 文件或包含真实凭据的配置
- 数据库文件（`.sqlite`、`.db`）
- 真实用户数据
- 盗版 Minecraft 服务端 jar
- 恶意插件、后门、盗号功能
- 绕正版验证、攻击服务器的功能

## 开发流程

```bash
# 1. Fork 本仓库
# 2. 创建功能分支
git checkout -b feat/your-feature

# 3. 开发并提交
pnpm install
pnpm test
git commit -m "feat: your feature"

# 4. 提交 Pull Request
```

## 代码规范

- TypeScript strict mode，禁止大量 `any`
- 每个包职责单一，不反向依赖应用层
- 文件操作必须通过 `file-operation` 包，禁止路径穿越
- 命令执行使用 `spawn(file, args[], { shell: false })`，禁止拼接 shell 字符串
