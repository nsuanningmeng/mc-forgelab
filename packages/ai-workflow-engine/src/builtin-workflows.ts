import type { WorkflowDefinition } from "./types.js";

export const BUILTIN_WORKFLOWS: readonly WorkflowDefinition[] = [
  {
    id: "simple-single-model",
    name: "单模型快速开发",
    mode: "single-model",
    description: "一个模型负责完整开发流程，适合简单插件或脚本",
    steps: [
      { id: "analyze", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt"], output: "requirementSpec", required: true },
      { id: "plan", role: "architect", modelProfile: "plannerModel", input: ["requirementSpec"], output: "projectPlan", required: true },
      { id: "template_init", role: "system_template_init", tool: "template_engine", input: ["projectPlan"], output: "initialFiles", required: true },
      { id: "generate", role: "code_generator", modelProfile: "plannerModel", input: ["projectPlan", "initialFiles"], output: "filePatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "plannerModel", maxRounds: 5, condition: "buildResult.status == failed", required: true },
      { id: "package", role: "system_package", tool: "artifact_manager", input: ["projectId", "buildResult"], output: "artifacts", required: true },
      { id: "summary", role: "final_summarizer", modelProfile: "plannerModel", input: ["projectPlan", "artifacts"], output: "finalSummary", required: false }
    ]
  },
  {
    id: "paper-plugin-standard",
    name: "通用插件开发工作流",
    mode: "multi-model",
    description: "适合生成 Paper/Purpur/Spigot 等 Bukkit 系列插件，多模型专业工作流",
    steps: [
      { id: "analyze", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt", "projectContext"], output: "requirementSpec", required: true },
      { id: "plan", role: "architect", modelProfile: "architectModel", input: ["requirementSpec"], output: "projectPlan", required: true },
      { id: "template_init", role: "system_template_init", tool: "template_engine", input: ["projectPlan"], output: "initialProjectFiles", required: true },
      { id: "generate", role: "code_generator", modelProfile: "codeModel", input: ["projectPlan", "initialProjectFiles"], output: "filePatch", required: true },
      { id: "review", role: "code_reviewer", modelProfile: "reviewModel", input: ["filePatch", "projectPlan"], output: "reviewReport", required: false },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "fixModel", maxRounds: 5, condition: "buildResult.status == failed", required: true },
      { id: "docs", role: "documentation_writer", modelProfile: "docModel", input: ["projectPlan", "finalFiles"], output: "documentationPatch", required: false },
      { id: "package", role: "system_package", tool: "artifact_manager", input: ["projectId", "buildResult"], output: "artifacts", required: true },
      { id: "summary", role: "final_summarizer", modelProfile: "summarizerModel", input: ["projectPlan", "artifacts", "buildResult"], output: "finalSummary", required: false }
    ]
  },
  {
    id: "fabric-mod-standard",
    name: "通用模组开发工作流",
    mode: "multi-model",
    description: "适合生成 Fabric/Forge/NeoForge/Quilt 等各类模组",
    steps: [
      { id: "analyze", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt"], output: "requirementSpec", required: true },
      { id: "plan", role: "architect", modelProfile: "architectModel", input: ["requirementSpec"], output: "projectPlan", required: true },
      { id: "template_init", role: "system_template_init", tool: "template_engine", input: ["projectPlan"], output: "initialProjectFiles", required: true },
      { id: "generate", role: "code_generator", modelProfile: "codeModel", input: ["projectPlan", "initialProjectFiles"], output: "filePatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "fixModel", maxRounds: 5, condition: "buildResult.status == failed", required: true },
      { id: "package", role: "system_package", tool: "artifact_manager", input: ["projectId", "buildResult"], output: "artifacts", required: true }
    ]
  },
  {
    id: "velocity-plugin-standard",
    name: "通用代理端插件工作流",
    mode: "multi-model",
    description: "适合生成 Velocity/BungeeCord 代理端插件",
    steps: [
      { id: "analyze", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt"], output: "requirementSpec", required: true },
      { id: "plan", role: "architect", modelProfile: "architectModel", input: ["requirementSpec"], output: "projectPlan", required: true },
      { id: "template_init", role: "system_template_init", tool: "template_engine", input: ["projectPlan"], output: "initialProjectFiles", required: true },
      { id: "generate", role: "code_generator", modelProfile: "codeModel", input: ["projectPlan", "initialProjectFiles"], output: "filePatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "fixModel", maxRounds: 5, condition: "buildResult.status == failed", required: true },
      { id: "package", role: "system_package", tool: "artifact_manager", input: ["projectId", "buildResult"], output: "artifacts", required: true }
    ]
  },
  {
    id: "fix-build-error",
    name: "修复编译错误",
    mode: "single-model",
    description: "专门用于修复已有项目的编译错误",
    steps: [
      { id: "analyze_error", role: "build_error_analyzer", modelProfile: "fixModel", input: ["buildLog", "projectFiles"], output: "errorAnalysis", required: true },
      { id: "fix", role: "auto_fixer", modelProfile: "fixModel", input: ["errorAnalysis", "projectFiles"], output: "filePatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "fixModel", maxRounds: 5, condition: "buildResult.status == failed", required: true }
    ]
  },
  {
    id: "modify-existing-project",
    name: "修改已有项目",
    mode: "multi-model",
    description: "在已有项目基础上添加功能或修改代码",
    steps: [
      { id: "analyze", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt", "projectFiles"], output: "requirementSpec", required: true },
      { id: "plan", role: "architect", modelProfile: "architectModel", input: ["requirementSpec", "projectFiles"], output: "modificationPlan", required: true },
      { id: "generate", role: "code_generator", modelProfile: "codeModel", input: ["modificationPlan", "projectFiles"], output: "filePatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["filePatch"], output: "patchResult", required: true },
      { id: "build", role: "system_build", tool: "build_orchestrator", input: ["projectId"], output: "buildResult", required: true },
      { id: "fix_loop", role: "auto_fix_loop", modelProfile: "fixModel", maxRounds: 5, condition: "buildResult.status == failed", required: true }
    ]
  },
  {
    id: "explain-project",
    name: "解释项目",
    mode: "single-model",
    description: "解释项目结构和代码逻辑",
    steps: [
      { id: "explain", role: "requirement_analyst", modelProfile: "plannerModel", input: ["userPrompt", "projectFiles"], output: "explanation", required: true }
    ]
  },
  {
    id: "generate-docs",
    name: "生成文档",
    mode: "single-model",
    description: "生成 README、配置说明、命令说明、权限说明",
    steps: [
      { id: "docs", role: "documentation_writer", modelProfile: "docModel", input: ["projectFiles", "projectPlan"], output: "documentationPatch", required: true },
      { id: "apply_patch", role: "system_apply_patch", tool: "file_operation", input: ["documentationPatch"], output: "patchResult", required: true }
    ]
  }
];
