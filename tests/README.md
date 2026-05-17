# tests/

阶段 1 单元测试位于各 package 的 `src/**/*.test.ts`，由 `vitest workspace` 聚合。

本目录预留用于跨包**集成测试**与**E2E 测试**：

- 阶段 5+：build orchestrator + toolchain manager + storage 端到端流水
- 阶段 6+：REST API + SSE 流测试
- 阶段 7+：Docker 镜像 smoke 测试
- 阶段 8+：Electron 应用端到端
