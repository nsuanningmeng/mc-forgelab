# Roadmap

## 阶段 1：基础架构 ✅
monorepo + TypeScript strict + logger + app-error + config + SQLite storage + Fastify Web API + CLI doctor

## 阶段 2：OpenAI Compatible Provider ✅
OpenAI Compatible API 接入 + 第三方 baseUrl 支持 + API Key 脱敏存储 + 测试连接 + 模型列表 + model profiles

## 阶段 3：AI Workflow Engine ✅
single-model / multi-model 工作流 + 8 个内置工作流 + workflow run/step 记录 + SSE 实时状态

## 阶段 4：Paper 插件生成闭环 ✅
Paper 模板 + AI 生成业务代码 + plugin.yml + Gradle 构建文件 + source 文件写入

## 阶段 5：自动构建与自动修错 ✅
Toolchain Manager + Build Orchestrator + ErrorAnalyzer + AutoFixer（最多 5 轮）+ 修复过程记录

## 阶段 6：Artifact 下载中心 ✅
jar / source.zip / build.log / manifest.json 下载 + sha256 + 流式下载 + 产物保留策略

## 阶段 7：Docker WebUI ✅
Dockerfile（多阶段构建，非 root）+ docker-compose.yml + React WebUI + Fastify 静态托管

## 阶段 8：Fabric / Velocity / Forge / NeoForge / Quilt 扩展 ✅
Fabric 模组模板 + Velocity 插件模板 + CLI 完善 + Electron 桌面端骨架

## 阶段 9：知识库与 RAG ✅
内置 Minecraft 开发知识库 + 关键字检索 + AI 上下文注入

## 阶段 10：增强功能（规划中）
- 知识库 RAG 向量检索
- 网络代理 / 镜像源设置
- 自定义工作流可视化编辑器
- 运行测试服务器
- 模板 marketplace（本地优先）
- 兼容性数据库更新机制
- Forge / NeoForge / Quilt 完整模板
- 混合端多模块项目支持
