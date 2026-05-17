# AI Provider Configuration

## 设计目标

MC-AI-ForgeLab 支持任何兼容 OpenAI API 格式的服务，不绑定特定厂商。

## 支持的 Provider 类型

| 类型 | 示例 |
|------|------|
| 官方 OpenAI API | `https://api.openai.com/v1` |
| 自建中转 API | `https://your-relay.example.com/v1` |
| 聚合 API | one-api / new-api / voapi |
| 反代 API | 任何兼容 `/v1/chat/completions` 的服务 |
| 本地模型 | `http://localhost:11434/v1`（Ollama） |

## 配置方式

通过 WebUI 的 AI 设置页面添加 Provider：

- **baseUrl**：API 地址（必填，用户自定义）
- **apiKey**：API 密钥（加密存储，不暴露给前端）
- **model**：默认模型名称

## 安全注意事项

- **不要将 API Key 写入日志**：系统自动脱敏，日志只显示 `sk-ab...xy12`
- **不要将 API Key 提交到 Git**：使用 `.env.example` 模板，真实值保存在 `.env`
- **SSRF 防护**：系统默认拒绝私有/回环 IP 的 baseUrl（可通过 `MC_FORGELAB_ALLOW_LOCAL_PROVIDERS=true` 允许本地模型）
- 第三方 API 使用需遵守对应服务的使用条款

## Model Profiles

系统支持为不同角色配置不同模型：

| 角色 | 用途 |
|------|------|
| `planner` | 需求分析和项目规划 |
| `architect` | 架构设计 |
| `coder` | 代码生成 |
| `reviewer` | 代码审查 |
| `fixer` | 编译错误修复 |
| `docs` | 文档生成 |
| `summarizer` | 总结说明 |

MVP 阶段可以让所有角色使用同一个模型。
