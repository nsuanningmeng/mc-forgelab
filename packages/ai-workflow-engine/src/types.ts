import type { ModelRole } from "@mc-forgelab/ai-provider-manager";

export type WorkflowMode = "single-model" | "multi-model" | "custom";
export type WorkflowRunStatus = "pending" | "running" | "success" | "failed" | "canceled";
export type WorkflowStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export type StepRole =
  | "requirement_analyst" | "architect" | "code_generator" | "code_reviewer"
  | "build_error_analyzer" | "auto_fixer" | "documentation_writer" | "final_summarizer"
  | "system_template_init" | "system_apply_patch" | "system_build" | "system_package"
  | "auto_fix_loop";

export const STEP_ROLE_TO_MODEL_ROLE: Readonly<Record<StepRole, ModelRole | null>> = {
  requirement_analyst: "planner",
  architect: "architect",
  code_generator: "coder",
  code_reviewer: "reviewer",
  build_error_analyzer: "fixer",
  auto_fixer: "fixer",
  documentation_writer: "docs",
  final_summarizer: "summarizer",
  system_template_init: null,
  system_apply_patch: null,
  system_build: null,
  system_package: null,
  auto_fix_loop: null
};

export function resolveModelRole(stepRole: StepRole): ModelRole | null {
  return STEP_ROLE_TO_MODEL_ROLE[stepRole];
}

export interface WorkflowStepDef {
  readonly id: string;
  readonly role: StepRole;
  readonly modelProfile?: string;
  readonly tool?: string;
  readonly input?: readonly string[];
  readonly output?: string;
  readonly required: boolean;
  readonly maxRounds?: number;
  readonly condition?: string;
}

export type WorkflowBuildStatus = "success" | "failed" | "canceled";

export type WorkflowBuildErrorCode =
  | "TOOLCHAIN_UNAVAILABLE"
  | "BUILD_FAILED"
  | "CANCELED"
  | "UNKNOWN";

export interface RuntimeConfig {
  readonly workspaceRoot: string;
  readonly logsDir?: string;
  readonly buildTimeoutMs?: number;
  readonly maxAutoFixTokens?: number;
  readonly maxAutoFixInputChars?: number;
}

export interface BuildRunnerInput {
  readonly projectId: string;
  readonly projectPath: string;
  readonly javaVersion?: 8 | 11 | 17 | 21;
  readonly timeoutMs?: number;
  readonly signal: AbortSignal;
  readonly onLog: (line: string) => void;
}

export interface WorkflowBuildResult {
  readonly status: WorkflowBuildStatus;
  readonly log?: string;
  readonly errorSummary?: string | null;
  readonly errorCode?: WorkflowBuildErrorCode;
}

export interface BuildRunner {
  run(input: BuildRunnerInput): Promise<WorkflowBuildResult>;
}

export interface PatchApplyOptions {
  readonly signal?: AbortSignal;
}

export interface PatchApplier {
  apply(input: { readonly projectPath: string; readonly patch: string }, options?: PatchApplyOptions): Promise<{ applied: number; errors: string[] }>;
}

export interface ToolExecutionContext {
  readonly runId: string;
  readonly stepRowId: string;
  readonly signal: AbortSignal;
  readonly emitLog: (line: string) => void;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly mode: WorkflowMode;
  readonly description: string;
  readonly steps: readonly WorkflowStepDef[];
}

export interface WorkflowRecord {
  readonly id: string;
  readonly name: string;
  readonly mode: WorkflowMode;
  readonly definitionJson: string;
  readonly builtin: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowRunRecord {
  readonly id: string;
  readonly workflowId: string;
  readonly projectId: string | null;
  readonly userPrompt: string;
  readonly status: WorkflowRunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly selectedProviderId: string | null;
  readonly selectedModel: string | null;
  readonly summary: string | null;
  readonly errorMessage: string | null;
}

export interface WorkflowStepRecord {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
  readonly role: StepRole;
  readonly modelProfile: string | null;
  readonly providerId: string | null;
  readonly model: string | null;
  readonly status: WorkflowStepStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly inputSummary: string | null;
  readonly outputSummary: string | null;
  readonly tokenUsageInput: number;
  readonly tokenUsageOutput: number;
  readonly costEstimate: number;
  readonly errorMessage: string | null;
}

/** SSE event emitted during a workflow run */
export type WorkflowEvent =
  | { type: "run_started"; runId: string; workflowId: string }
  | { type: "step_started"; runId: string; stepId: string; role: StepRole }
  | { type: "step_output"; runId: string; stepId: string; chunk: string }
  | { type: "step_finished"; runId: string; stepId: string; status: WorkflowStepStatus; outputSummary?: string }
  | { type: "run_finished"; runId: string; status: WorkflowRunStatus; summary?: string }
  | { type: "error"; runId: string; code: string; message: string };
