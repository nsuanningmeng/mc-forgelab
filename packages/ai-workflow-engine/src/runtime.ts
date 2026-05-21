import { randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { AppError } from "@mc-forgelab/app-error";
import type { ProviderManager } from "@mc-forgelab/ai-provider-manager";
import type { Storage } from "@mc-forgelab/storage";
import type { WorkflowEngine } from "./engine.js";
import type {
  BuildRunner,
  PatchApplier,
  RuntimeConfig,
  StepRole,
  ToolExecutionContext,
  WorkflowBuildResult,
  WorkflowDefinition,
  WorkflowRunStatus,
  WorkflowStepDef,
  WorkflowStepStatus
} from "./types.js";
import { applyStepOutput, createContext, resolveStepInputs, type WorkflowContextSnapshot } from "./context.js";
import { createFakeChatAdapter, createRealChatAdapter, type ChatAdapter, type ChatAdapterResult } from "./chat-adapter.js";
import { createProviderResolver } from "./provider-resolver.js";

type RuntimeRunStatus = WorkflowRunStatus | "waiting_confirmation";
type StepRuntimeStatus = "success" | "failed" | "skipped";
type JavaVersion = 8 | 11 | 17 | 21;

const BUILD_LOG_TAIL_LINES = 300;
const BUFFERED_LOG_LINES = 10;
const BUFFERED_LOG_INTERVAL_MS = 500;
const DEFAULT_MAX_AUTO_FIX_TOKENS = 100_000;
const DEFAULT_MAX_AUTO_FIX_INPUT_CHARS = 50_000;
const MAX_AUTO_FIX_ROUNDS = 10;
const SUPPORTED_AUTO_FIX_CONDITION_PATTERN = /^buildResult\.status\s*={2,3}\s*(?:"failed"|'failed'|failed)$/;

export type RuntimeEvent =
  | { type: "run_started"; runId: string; workflowId: string }
  | { type: "step_started"; runId: string; stepRowId: string; stepId: string; role: StepRole; sequence: number }
  | { type: "step_log"; runId: string; stepRowId: string; line: string }
  | { type: "model_delta"; runId: string; stepRowId: string; chunk: string }
  | { type: "step_finished"; runId: string; stepRowId: string; stepId: string; status: StepRuntimeStatus; outputSummary?: string; tokensIn?: number; tokensOut?: number; durationMs?: number }
  | { type: "patch_pending"; runId: string; stepRowId: string; diffPreview: string }
  | { type: "run_finished"; runId: string; status: RuntimeRunStatus; summary?: string; errorMessage?: string }
  | { type: "heartbeat"; runId: string };

export interface StartRunInput {
  workflowId: string;
  userPrompt: string;
  projectId?: string;
  providerId?: string;
  model?: string;
  patchReviewEnabled?: boolean;
  triggerType?: "manual" | "auto-fix";
  parentRunId?: string;
  retryOfRunId?: string;
}

export interface WorkflowRuntime {
  startRun(input: StartRunInput): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<boolean>;
  retryRunFromStep(runId: string, stepId: string): Promise<{ runId: string }>;
  confirmPatch(runId: string, decision: "approve" | "reject", editedPatch?: string): Promise<void>;
  subscribe(runId: string, listener: (event: RuntimeEvent) => void): () => void;
  loadRunEvents(runId: string): RuntimeEvent[];
  closeAll(): void;
}

interface RuntimeDeps {
  readonly storage: Storage;
  readonly engine: WorkflowEngine;
  readonly workflows: readonly WorkflowDefinition[];
  readonly providers?: ProviderManager;
  readonly config?: RuntimeConfig;
  readonly buildRunner?: BuildRunner;
  readonly patchApplier?: PatchApplier;
}

interface ResolvedChatAdapter {
  readonly adapter: ChatAdapter;
  readonly providerId: string;
  readonly model: string;
  readonly source: "fake" | "real";
}

interface RunningRun {
  readonly controller: AbortController;
  readonly listeners: Set<(event: RuntimeEvent) => void>;
  readonly patchWaiters: Map<string, PatchWaiter>;
}

interface PatchWaiter {
  resolve(decision: PatchDecision): void;
  reject(error: Error): void;
}

interface PatchDecision {
  readonly decision: "approve" | "reject";
  readonly editedPatch?: string;
}

interface EventRow {
  readonly payload_json: string;
}

interface ProjectRuntimeRow {
  readonly project_path: string | null;
  readonly java_version: number | null;
}

interface ProjectBuildConfig {
  readonly projectPath: string;
  readonly javaVersion?: JavaVersion;
}

interface PatchApplyFailure {
  readonly kind: "patch_apply_failed";
  readonly message: string;
  readonly errors: readonly string[];
  readonly patchPreview: string;
}

class PatchApplyFailureError extends Error implements PatchApplyFailure {
  override readonly name = "PatchApplyFailureError";
  readonly kind = "patch_apply_failed";

  constructor(message: string, readonly errors: readonly string[], readonly patchPreview: string) {
    super(message);
  }
}

function isPatchApplyFailure(error: unknown): error is PatchApplyFailure {
  return error instanceof PatchApplyFailureError;
}

const TERMINAL_RUN_STATUSES = new Set<string>(["success", "failed", "canceled"]);

function isModelStep(step: WorkflowStepDef): boolean {
  return !step.tool && !step.role.startsWith("system_") && step.role !== "auto_fix_loop";
}

function summarize(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.slice(0, 400);
}

function promptFromInputs(inputs: Record<string, string>): string {
  return Object.entries(inputs).map(([key, value]) => `## ${key}\n${value}`).join("\n\n");
}

function nextTick(fn: () => void): void {
  setImmediate(fn);
}

function isJavaVersion(value: number | null | undefined): value is JavaVersion {
  return value === 8 || value === 11 || value === 17 || value === 21;
}

function tailLog(log: string | undefined, fallbackLines: readonly string[]): string | undefined {
  const lines = log !== undefined ? log.split(/\r?\n/) : fallbackLines.slice();
  const tail = lines.filter((line) => line.length > 0).slice(-BUILD_LOG_TAIL_LINES);
  return tail.length > 0 ? tail.join("\n") : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.messageEn;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isToolchainUnavailableError(error: unknown): boolean {
  const message = errorMessage(error);
  return /toolchain|jdk|java|gradle|JAVA_HOME|executable/i.test(message);
}

function firstNonEmptyInput(inputs: Record<string, string>): string {
  return Object.values(inputs).find((value) => value.trim().length > 0) ?? "";
}

function evaluateAutoFixCondition(condition: string | undefined, context: WorkflowContextSnapshot): boolean | "unsupported" {
  const normalized = condition?.trim() ?? "buildResult.status == failed";
  if (!SUPPORTED_AUTO_FIX_CONDITION_PATTERN.test(normalized)) return "unsupported";
  return context.buildResult?.status === "failed";
}

function makeVirtualModelStep(base: WorkflowStepDef, role: "build_error_analyzer" | "auto_fixer"): WorkflowStepDef {
  return {
    id: `${base.id}:${role}`,
    role,
    modelProfile: base.modelProfile,
    required: true
  };
}

function tokenTotal(tokensIn: number, tokensOut: number): number {
  return tokensIn + tokensOut;
}

function truncateForAutoFixInput(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const marker = `\n\n[truncated ${value.length} chars to fit auto-fix input limit ${maxChars}]\n\n`;
  if (maxChars <= marker.length) return value.slice(0, maxChars);
  const remaining = maxChars - marker.length;
  const head = Math.ceil(remaining / 2);
  const tail = Math.floor(remaining / 2);
  return `${value.slice(0, head)}${marker}${value.slice(value.length - tail)}`;
}

function isContainedPath(base: string, candidate: string): boolean {
  const rel = relative(base, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function resolveContainedProjectPath(workspaceRoot: string, projectId: string, dbPath: string | null | undefined): string {
  const workspace = resolve(workspaceRoot);
  const fallback = resolve(workspace, "projects", projectId);
  const candidate = dbPath && dbPath.trim().length > 0
    ? (isAbsolute(dbPath) ? resolve(dbPath) : resolve(workspace, dbPath))
    : fallback;
  if (!isContainedPath(workspace, candidate)) {
    throw new Error(`Project path for ${projectId} must be inside workspace.`);
  }
  return candidate;
}

export function createWorkflowRuntime(deps: RuntimeDeps): WorkflowRuntime {
  const fakeProvider = createFakeChatAdapter();
  const providerResolver = createProviderResolver(deps.providers);
  const running = new Map<string, RunningRun>();
  const eventSequences = new Map<string, number>();

  function workflowById(workflowId: string): WorkflowDefinition | undefined {
    return deps.workflows.find((workflow) => workflow.id === workflowId);
  }

  function getOrCreateRunning(runId: string): RunningRun {
    const existing = running.get(runId);
    if (existing) return existing;
    const created: RunningRun = {
      controller: new AbortController(),
      listeners: new Set(),
      patchWaiters: new Map()
    };
    running.set(runId, created);
    return created;
  }

  function currentEventSequence(runId: string): number {
    const cached = eventSequences.get(runId);
    if (cached !== undefined) return cached;
    const rows = deps.storage.backend.all<{ sequence: number }>(
      "SELECT sequence FROM ai_workflow_events WHERE run_id = ? ORDER BY sequence",
      [runId]
    );
    const max = rows.reduce((acc, row) => Math.max(acc, Number(row.sequence ?? 0)), 0);
    eventSequences.set(runId, max);
    return max;
  }

  function persistEvent(event: RuntimeEvent): void {
    const sequence = currentEventSequence(event.runId) + 1;
    eventSequences.set(event.runId, sequence);
    const stepRowId = "stepRowId" in event ? event.stepRowId : null;
    deps.storage.backend.run(
      "INSERT INTO ai_workflow_events (id, run_id, step_row_id, type, payload_json, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), event.runId, stepRowId, event.type, JSON.stringify(event), new Date().toISOString(), sequence]
    );
  }

  function broadcast(event: RuntimeEvent): void {
    const state = running.get(event.runId);
    if (!state) return;
    for (const listener of state.listeners) {
      listener(event);
    }
  }

  function emit(event: RuntimeEvent): void {
    persistEvent(event);
    broadcast(event);
  }

  function createBufferedStepLogger(runId: string, stepRowId: string, signal: AbortSignal): { log(line: string): void; flush(): void } {
    const buffer: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (buffer.length === 0) return;
      const line = buffer.splice(0, buffer.length).join("\n");
      emit({ type: "step_log", runId, stepRowId, line });
    };

    const scheduleFlush = (): void => {
      if (!timer) timer = setTimeout(flush, BUFFERED_LOG_INTERVAL_MS);
    };

    signal.addEventListener("abort", flush, { once: true });

    return {
      log(line) {
        if (signal.aborted) return;
        buffer.push(line);
        if (buffer.length >= BUFFERED_LOG_LINES) flush();
        else scheduleFlush();
      },
      flush
    };
  }

  function updateRunRuntimeState(runId: string, fields: Record<string, string | number | null>): void {
    const entries = Object.entries(fields);
    if (entries.length === 0) return;
    const setSql = entries.map(([key]) => `${key}=?`).join(", ");
    const values = entries.map(([, value]) => value);
    deps.storage.backend.run(`UPDATE ai_workflow_runs SET ${setSql} WHERE id=?`, [...values, runId]);
  }

  function saveOutput(runId: string, stepRowId: string, key: string | undefined, value: unknown): void {
    if (!key) return;
    deps.storage.backend.run(
      "INSERT INTO ai_workflow_outputs (id, run_id, step_row_id, key, content_type, value_text, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), runId, stepRowId, key, "text", typeof value === "string" ? value : JSON.stringify(value), null, new Date().toISOString()]
    );
  }

  function runIsTerminal(runId: string): boolean {
    const row = deps.storage.backend.get<{ status: string }>("SELECT status FROM ai_workflow_runs WHERE id = ?", [runId]);
    return row ? TERMINAL_RUN_STATUSES.has(row.status) : true;
  }

  function throwIfAborted(runId: string, signal: AbortSignal): void {
    if (signal.aborted || runIsTerminal(runId)) {
      throw new Error("Workflow run canceled");
    }
  }

  async function waitForPatch(runId: string, stepRowId: string, diffPreview: string, signal: AbortSignal): Promise<PatchDecision> {
    updateRunRuntimeState(runId, { status: "waiting_confirmation", waiting_for: stepRowId });
    emit({ type: "patch_pending", runId, stepRowId, diffPreview });

    return new Promise<PatchDecision>((resolve, reject) => {
      const state = getOrCreateRunning(runId);
      state.patchWaiters.set(stepRowId, { resolve, reject });
      const onAbort = () => {
        state.patchWaiters.delete(stepRowId);
        reject(new Error("Workflow run canceled"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }).finally(() => {
      // If the run was canceled while waiting, do NOT clobber the canceled
      // status back to running. Only clear waiting_for; the cancel path
      // already wrote canceled_at + status=canceled.
      if (runIsTerminal(runId)) {
        updateRunRuntimeState(runId, { waiting_for: null });
        return;
      }
      updateRunRuntimeState(runId, { waiting_for: null, status: "running" });
    });
  }

  function resolveProjectBuildConfig(projectId: string | undefined): ProjectBuildConfig {
    const workspaceRoot = deps.config?.workspaceRoot ?? process.cwd();
    if (!projectId) {
      throw new Error("Project id is required to resolve project build config.");
    }

    let row: ProjectRuntimeRow | undefined;
    try {
      row = deps.storage.backend.get<ProjectRuntimeRow>(
        "SELECT project_path, java_version FROM projects WHERE id = ?",
        [projectId]
      );
    } catch {
      row = undefined;
    }

    const projectPath = resolveContainedProjectPath(workspaceRoot, projectId, row?.project_path);
    const javaVersion = isJavaVersion(row?.java_version) ? row.java_version : undefined;
    return { projectPath, javaVersion };
  }

  async function executeBuild(projectId: string | undefined, toolContext: ToolExecutionContext): Promise<WorkflowBuildResult> {
    if (!deps.buildRunner) {
      toolContext.emitLog("No BuildRunner configured; using fake build result.");
      return { status: "success", log: "Fake build completed successfully." };
    }

    if (!projectId) {
      return {
        status: "failed",
        errorCode: "UNKNOWN",
        errorSummary: "Project id is required for system_build."
      };
    }

    const lines: string[] = [];
    const project = resolveProjectBuildConfig(projectId);
    try {
      const result = await deps.buildRunner.run({
        projectId,
        projectPath: project.projectPath,
        javaVersion: project.javaVersion,
        timeoutMs: deps.config?.buildTimeoutMs,
        signal: toolContext.signal,
        onLog: (line) => {
          lines.push(line);
          toolContext.emitLog(line);
        }
      });

      return {
        ...result,
        log: tailLog(result.log, lines),
        errorCode: result.errorCode ?? (result.status === "failed" ? "BUILD_FAILED" : result.status === "canceled" ? "CANCELED" : undefined)
      };
    } catch (error) {
      const message = errorMessage(error);
      if (toolContext.signal.aborted) {
        return { status: "canceled", errorCode: "CANCELED", errorSummary: "Workflow run canceled.", log: tailLog(undefined, lines) };
      }
      if (isToolchainUnavailableError(error)) {
        return { status: "failed", errorCode: "TOOLCHAIN_UNAVAILABLE", errorSummary: message, log: tailLog(undefined, lines) };
      }
      return { status: "failed", errorCode: "UNKNOWN", errorSummary: message, log: tailLog(undefined, lines) };
    }
  }

  async function executeApplyPatch(projectId: string | undefined, patch: string, toolContext: ToolExecutionContext): Promise<{ applied: number; errors: string[] } | string> {
    if (!deps.patchApplier) {
      toolContext.emitLog("No PatchApplier configured; using fake patch result.");
      return "Patch applied successfully by the deterministic v0.3.0 stub.";
    }

    if (!projectId) {
      throw new Error("Project id is required for system_apply_patch.");
    }

    if (!patch.trim()) {
      throw new Error("No patch content supplied.");
    }

    const project = resolveProjectBuildConfig(projectId);
    let result: { applied: number; errors: string[] };
    try {
      result = await deps.patchApplier.apply(
        { projectPath: project.projectPath, patch },
        { signal: toolContext.signal }
      );
    } catch (error) {
      if (toolContext.signal.aborted) throw error;
      const message = errorMessage(error);
      throw new PatchApplyFailureError(`Patch apply failed: ${message}`, [message], summarize(patch));
    }
    if (result.errors.length > 0) {
      throw new PatchApplyFailureError(`Patch apply failed: ${result.errors.join("; ")}`, result.errors, summarize(patch));
    }
    toolContext.emitLog(`Patch applied successfully: ${result.applied} operation(s).`);
    return result;
  }

  async function invokeAutoFixModel(
    baseStep: WorkflowStepDef,
    role: "build_error_analyzer" | "auto_fixer",
    inputs: Record<string, string>,
    runProviderId: string | null,
    runModel: string | null,
    toolContext: ToolExecutionContext
  ): Promise<ChatAdapterResult> {
    const virtualStep = makeVirtualModelStep(baseStep, role);
    const resolved = resolveChatAdapter(virtualStep, runProviderId, runModel);
    toolContext.emitLog(
      resolved.source === "fake"
        ? `Auto-fix invoking fake provider for ${role}.`
        : `Auto-fix invoking provider ${resolved.providerId} model ${resolved.model} for ${role}.`
    );
    return resolved.adapter.invoke(role, promptFromInputs(inputs), inputs, { signal: toolContext.signal });
  }

  async function executeAutoFixLoop(
    step: WorkflowStepDef,
    workflowContext: WorkflowContextSnapshot,
    runProviderId: string | null,
    runModel: string | null,
    toolContext: ToolExecutionContext
  ): Promise<{ status: StepRuntimeStatus; outputSummary: string; tokensIn: number; tokensOut: number }> {
    const condition = evaluateAutoFixCondition(step.condition, workflowContext);
    if (condition === "unsupported") {
      toolContext.emitLog(`Skipped auto-fix loop because condition is not whitelisted: ${step.condition ?? ""}`);
      return { status: "skipped", outputSummary: "Skipped because condition is not supported.", tokensIn: 0, tokensOut: 0 };
    }
    if (!condition) {
      return { status: "skipped", outputSummary: "Skipped because build did not fail.", tokensIn: 0, tokensOut: 0 };
    }

    const projectId = workflowContext.projectId;
    const maxRounds = Math.min(MAX_AUTO_FIX_ROUNDS, Math.max(1, step.maxRounds ?? 5));
    const maxTokens = deps.config?.maxAutoFixTokens ?? DEFAULT_MAX_AUTO_FIX_TOKENS;
    const maxInputChars = Math.max(1, deps.config?.maxAutoFixInputChars ?? DEFAULT_MAX_AUTO_FIX_INPUT_CHARS);
    let tokensIn = 0;
    let tokensOut = 0;
    let lastError = workflowContext.buildResult?.errorSummary ?? "Build failed.";
    let previousPatchFailure: PatchApplyFailure | undefined;

    for (let round = 1; round <= maxRounds; round++) {
      throwIfAborted(toolContext.runId, toolContext.signal);
      toolContext.emitLog(`Auto-fix round ${round}/${maxRounds} started.`);

      try {
        const buildResultText = truncateForAutoFixInput(JSON.stringify(workflowContext.buildResult ?? {}), maxInputChars);
        const buildLogText = truncateForAutoFixInput(workflowContext.buildResult?.log ?? workflowContext.buildLog ?? "", maxInputChars);
        const previousPatchFailureText = previousPatchFailure
          ? truncateForAutoFixInput(JSON.stringify(previousPatchFailure), maxInputChars)
          : "";
        const analyzerInputs: Record<string, string> = {
          buildResult: buildResultText,
          buildLog: buildLogText,
          errorSummary: truncateForAutoFixInput(workflowContext.buildResult?.errorSummary ?? "", maxInputChars)
        };
        if (previousPatchFailureText) {
          analyzerInputs.previousPatchFailure = previousPatchFailureText;
        }
        const analyzer = await invokeAutoFixModel(step, "build_error_analyzer", analyzerInputs, runProviderId, runModel, toolContext);
        tokensIn += analyzer.tokensIn;
        tokensOut += analyzer.tokensOut;
        if (tokenTotal(tokensIn, tokensOut) > maxTokens) {
          throw new Error(`Auto-fix token budget exceeded (${tokenTotal(tokensIn, tokensOut)}/${maxTokens}).`);
        }

        const fixerInputs: Record<string, string> = {
          errorAnalysis: truncateForAutoFixInput(analyzer.text, maxInputChars),
          buildResult: buildResultText,
          buildLog: buildLogText,
          projectPlan: truncateForAutoFixInput(workflowContext.projectPlan ?? "", maxInputChars),
          filePatch: truncateForAutoFixInput(workflowContext.filePatch ?? "", maxInputChars)
        };
        if (previousPatchFailureText) {
          fixerInputs.previousPatchFailure = previousPatchFailureText;
        }
        const fixer = await invokeAutoFixModel(step, "auto_fixer", fixerInputs, runProviderId, runModel, toolContext);
        tokensIn += fixer.tokensIn;
        tokensOut += fixer.tokensOut;
        if (tokenTotal(tokensIn, tokensOut) > maxTokens) {
          throw new Error(`Auto-fix token budget exceeded (${tokenTotal(tokensIn, tokensOut)}/${maxTokens}).`);
        }

        workflowContext.filePatch = fixer.text;
        const patchResult = await executeApplyPatch(projectId, fixer.text, toolContext);
        workflowContext.patchResult = typeof patchResult === "string" ? patchResult : JSON.stringify(patchResult);
        previousPatchFailure = undefined;

        const buildResult = await executeBuild(projectId, toolContext);
        workflowContext.buildResult = buildResult;
        workflowContext.buildLog = buildResult.log;
        lastError = buildResult.errorSummary ?? lastError;

        if (buildResult.status === "success") {
          return { status: "success", outputSummary: `Auto-fix succeeded after ${round} round(s).`, tokensIn, tokensOut };
        }
        toolContext.emitLog(`Auto-fix round ${round} build status: ${buildResult.status}.`);
      } catch (error) {
        if (toolContext.signal.aborted) throw error;
        const message = errorMessage(error);
        if (message.startsWith("Auto-fix token budget exceeded")) throw error;
        if (isPatchApplyFailure(error)) {
          previousPatchFailure = error;
        }
        lastError = message;
        toolContext.emitLog(`Auto-fix round ${round} failed: ${message}`);
      }
    }

    return { status: "failed", outputSummary: `Auto-fix failed after ${maxRounds} round(s): ${lastError}`, tokensIn, tokensOut };
  }

  async function runTool(step: WorkflowStepDef, inputs: Record<string, string>, workflowContext: WorkflowContextSnapshot, toolContext: ToolExecutionContext): Promise<unknown> {
    switch (step.role) {
      case "system_template_init":
        return JSON.stringify({
          files: [
            { path: "src/main/java/com/example/Main.java", content: "" },
            { path: "src/main/resources/plugin.yml", content: "" },
            { path: "build.gradle.kts", content: "" }
          ]
        });
      case "system_apply_patch":
        return executeApplyPatch(
          workflowContext.projectId,
          inputs.filePatch ?? inputs.documentationPatch ?? firstNonEmptyInput(inputs),
          toolContext
        );
      case "system_build":
        return executeBuild(workflowContext.projectId ?? inputs.projectId, toolContext);
      case "system_package":
        return "Generated fake artifact: build/libs/forgelab-generated-0.3.0.jar";
      default:
        return "Tool completed successfully.";
    }
  }

  function resolveChatAdapter(step: WorkflowStepDef, runProviderId?: string | null, runModel?: string | null): ResolvedChatAdapter {
    const resolved = providerResolver.resolve(step, runProviderId, runModel);
    if (!resolved) {
      return {
        adapter: fakeProvider,
        providerId: "fake",
        model: "fake-model",
        source: "fake"
      };
    }
    return {
      adapter: createRealChatAdapter(resolved.adapter, resolved.profile),
      providerId: resolved.providerId,
      model: resolved.model,
      source: "real"
    };
  }

  async function executeStep(runId: string, step: WorkflowStepDef, sequence: number, context: WorkflowContextSnapshot, runProviderId: string | null, runModel: string | null, signal: AbortSignal): Promise<void> {
    const started = Date.now();
    const stepRecord = deps.engine.createStep(runId, step.id, step.role, step.modelProfile);
    deps.storage.backend.run("UPDATE ai_workflow_steps SET sequence=? WHERE id=?", [sequence, stepRecord.id]);
    deps.engine.updateStepStatus(stepRecord.id, "running");
    emit({ type: "step_started", runId, stepRowId: stepRecord.id, stepId: step.id, role: step.role, sequence });

    throwIfAborted(runId, signal);

    const inputs = resolveStepInputs(context, step.input);
    const inputSummary = summarize(inputs);
    deps.storage.backend.run("UPDATE ai_workflow_steps SET input_summary=? WHERE id=?", [inputSummary, stepRecord.id]);

    let value: unknown;
    let tokensIn = 0;
    let tokensOut = 0;
    const failStep = (error: unknown): void => {
      const durationMs = Date.now() - started;
      const message = error instanceof AppError ? error.messageEn : (error instanceof Error ? error.message : String(error));
      deps.storage.backend.run("UPDATE ai_workflow_steps SET duration_ms=? WHERE id=?", [durationMs, stepRecord.id]);
      deps.engine.updateStepStatus(stepRecord.id, "failed", { inputTokens: tokensIn, outputTokens: tokensOut, errorMessage: message });
      emit({ type: "step_finished", runId, stepRowId: stepRecord.id, stepId: step.id, status: "failed", outputSummary: message, tokensIn, tokensOut, durationMs });
    };

    const stepLogger = createBufferedStepLogger(runId, stepRecord.id, signal);
    const toolContext: ToolExecutionContext = {
      runId,
      stepRowId: stepRecord.id,
      signal,
      emitLog: (line) => stepLogger.log(line)
    };

    if (step.role === "auto_fix_loop") {
      try {
        const result = await executeAutoFixLoop(step, context, runProviderId, runModel, toolContext);
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        stepLogger.flush();
        const durationMs = Date.now() - started;
        deps.storage.backend.run("UPDATE ai_workflow_steps SET duration_ms=? WHERE id=?", [durationMs, stepRecord.id]);
        deps.engine.updateStepStatus(stepRecord.id, result.status, {
          outputSummary: result.outputSummary,
          inputTokens: tokensIn,
          outputTokens: tokensOut,
          errorMessage: result.status === "failed" ? result.outputSummary : undefined
        });
        emit({ type: "step_finished", runId, stepRowId: stepRecord.id, stepId: step.id, status: result.status, outputSummary: result.outputSummary, tokensIn, tokensOut, durationMs });
        if (result.status === "failed") {
          throw new Error(result.outputSummary);
        }
        return;
      } catch (error) {
        stepLogger.flush();
        // Only call failStep if step wasn't already marked failed above
        const stepRow = deps.storage.backend.get<{ status: string }>("SELECT status FROM ai_workflow_steps WHERE id = ?", [stepRecord.id]);
        if (stepRow?.status !== "failed") {
          failStep(error);
        }
        throw error;
      }
    }

    if (isModelStep(step)) {
      try {
        const resolved = resolveChatAdapter(step, runProviderId, runModel);
        deps.storage.backend.run(
          "UPDATE ai_workflow_steps SET provider_id=?, model=? WHERE id=?",
          [resolved.providerId, resolved.model, stepRecord.id]
        );
        emit({
          type: "step_log",
          runId,
          stepRowId: stepRecord.id,
          line: resolved.source === "fake"
            ? `Invoking fake provider for ${step.role}.`
            : `Invoking provider ${resolved.providerId} model ${resolved.model} for ${step.role}.`
        });
        if (resolved.source === "fake" && (runProviderId || deps.providers)) {
          emit({ type: "step_log", runId, stepRowId: stepRecord.id, line: "WARNING: No matching provider/profile found, falling back to fake provider." });
        }
        emit({ type: "step_log", runId, stepRowId: stepRecord.id, line: "Resolved step inputs." });
        const response = await resolved.adapter.invoke(step.role, promptFromInputs(inputs), inputs, {
          signal,
          onDelta: (chunk) => {
            if (chunk.length > 0) emit({ type: "model_delta", runId, stepRowId: stepRecord.id, chunk });
          }
        });
        throwIfAborted(runId, signal);
        value = response.text;
        tokensIn = response.tokensIn;
        tokensOut = response.tokensOut;
      } catch (error) {
        failStep(error);
        throw error;
      }
    } else {
      try {
        value = await runTool(step, inputs, context, toolContext);
        stepLogger.flush();
        throwIfAborted(runId, signal);
      } catch (error) {
        stepLogger.flush();
        failStep(error);
        throw error;
      }
    }

    if (step.output === "filePatch" && context.filePatch === undefined && typeof value === "string") {
      applyStepOutput(context, step.output, value);
    }

    if (step.output === "filePatch") {
      const run = deps.storage.backend.get<{ patch_review_enabled: number }>("SELECT patch_review_enabled FROM ai_workflow_runs WHERE id = ?", [runId]);
      if ((run?.patch_review_enabled ?? 0) === 1) {
        const decision = await waitForPatch(runId, stepRecord.id, summarize(value), signal);
        throwIfAborted(runId, signal);
        if (decision.decision === "reject") {
          throw new Error("Patch rejected by reviewer");
        }
        if (decision.editedPatch !== undefined) {
          value = decision.editedPatch;
        }
      }
    }

    applyStepOutput(context, step.output, value);
    saveOutput(runId, stepRecord.id, step.output, value);

    const outputSummary = summarize(value);
    const durationMs = Date.now() - started;
    deps.storage.backend.run("UPDATE ai_workflow_steps SET duration_ms=? WHERE id=?", [durationMs, stepRecord.id]);
    deps.engine.updateStepStatus(stepRecord.id, "success", { outputSummary, inputTokens: tokensIn, outputTokens: tokensOut });
    emit({ type: "step_finished", runId, stepRowId: stepRecord.id, stepId: step.id, status: "success", outputSummary, tokensIn, tokensOut, durationMs });
  }

  async function executeRun(runId: string, workflow: WorkflowDefinition, fromStepId?: string): Promise<void> {
    // Guard against a race where cancelRun fired between startRun()
    // emitting and the setImmediate callback firing. If the run is
    // already terminal (canceled / failed), bail out cleanly so we
    // don't resurrect it.
    if (runIsTerminal(runId)) {
      running.delete(runId);
      return;
    }
    const state = getOrCreateRunning(runId);
    const signal = state.controller.signal;
    if (signal.aborted) {
      running.delete(runId);
      return;
    }
    const run = deps.engine.getRun(runId);
    const context = createContext({
      userPrompt: run.userPrompt,
      projectId: run.projectId ?? undefined
    });

    try {
      deps.engine.updateRunStatus(runId, "running");
      const startIndex = fromStepId ? Math.max(0, workflow.steps.findIndex((step) => step.id === fromStepId)) : 0;
      const steps = workflow.steps.slice(startIndex);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        try {
          await executeStep(runId, step, startIndex + i + 1, context, run.selectedProviderId, run.selectedModel, signal);
        } catch (error) {
          if (!step.required) {
            continue;
          }
          throw error;
        }
      }

      throwIfAborted(runId, signal);
      const summary = context.finalSummary ?? "Workflow completed successfully.";
      deps.engine.updateRunStatus(runId, "success", summary);
      emit({ type: "run_finished", runId, status: "success", summary });
    } catch (error) {
      if (!runIsTerminal(runId)) {
        const message = error instanceof Error ? error.message : String(error);
        deps.engine.updateRunStatus(runId, "failed", undefined, message);
        emit({ type: "run_finished", runId, status: "failed", errorMessage: message });
      }
    } finally {
      running.delete(runId);
    }
  }

  return {
    async startRun(input) {
      const workflow = workflowById(input.workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${input.workflowId}`);
      }

      const run = deps.engine.createRun(input.workflowId, input.userPrompt, input.projectId, input.providerId, input.model);
      updateRunRuntimeState(run.id, {
        parent_run_id: input.parentRunId ?? null,
        trigger_type: input.triggerType ?? "manual",
        patch_review_enabled: input.patchReviewEnabled ? 1 : 0,
        retry_of_run_id: input.retryOfRunId ?? null
      });
      getOrCreateRunning(run.id);
      emit({ type: "run_started", runId: run.id, workflowId: input.workflowId });
      nextTick(() => {
        void executeRun(run.id, workflow);
      });
      return { runId: run.id };
    },

    async cancelRun(runId) {
      const run = deps.storage.backend.get<{ id: string; status: string }>("SELECT id, status FROM ai_workflow_runs WHERE id = ?", [runId]);
      if (!run || TERMINAL_RUN_STATUSES.has(run.status)) return false;

      const state = getOrCreateRunning(runId);
      state.controller.abort();
      for (const waiter of state.patchWaiters.values()) {
        waiter.reject(new Error("Workflow run canceled"));
      }
      state.patchWaiters.clear();

      const now = new Date().toISOString();
      updateRunRuntimeState(runId, { canceled_at: now, waiting_for: null });
      deps.engine.updateRunStatus(runId, "canceled", undefined, "Workflow run canceled.");
      emit({ type: "run_finished", runId, status: "canceled", errorMessage: "Workflow run canceled." });
      running.delete(runId);
      return true;
    },

    async retryRunFromStep(runId, stepId) {
      const oldRun = deps.engine.getRun(runId);
      const workflow = workflowById(oldRun.workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${oldRun.workflowId}`);
      }
      // Create the retry run directly, without going through startRun, so
      // we don't schedule a full-workflow execution that would race with
      // our partial-from-step execution.
      const newRun = deps.engine.createRun(
        oldRun.workflowId,
        oldRun.userPrompt,
        oldRun.projectId ?? undefined,
        oldRun.selectedProviderId ?? undefined,
        oldRun.selectedModel ?? undefined
      );
      updateRunRuntimeState(newRun.id, {
        parent_run_id: runId,
        trigger_type: "manual",
        patch_review_enabled: 0,
        retry_of_run_id: runId
      });
      getOrCreateRunning(newRun.id);
      emit({ type: "run_started", runId: newRun.id, workflowId: oldRun.workflowId });
      nextTick(() => {
        void executeRun(newRun.id, workflow, stepId);
      });
      return { runId: newRun.id };
    },

    async confirmPatch(runId, decision, editedPatch) {
      const run = deps.storage.backend.get<{ waiting_for: string | null }>("SELECT waiting_for FROM ai_workflow_runs WHERE id = ?", [runId]);
      const waitingFor = run?.waiting_for;
      if (!waitingFor) {
        throw new Error("Workflow run is not waiting for patch confirmation");
      }
      const state = running.get(runId);
      const waiter = state?.patchWaiters.get(waitingFor);
      if (!state || !waiter) {
        throw new Error("Patch confirmation waiter not found");
      }
      state.patchWaiters.delete(waitingFor);
      waiter.resolve({ decision, editedPatch });
    },

    subscribe(runId, listener) {
      const state = getOrCreateRunning(runId);
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },

    loadRunEvents(runId) {
      return deps.storage.backend.all<EventRow>(
        "SELECT payload_json FROM ai_workflow_events WHERE run_id = ? ORDER BY sequence",
        [runId]
      ).map((row) => JSON.parse(row.payload_json) as RuntimeEvent);
    },

    closeAll() {
      for (const [runId, state] of running) {
        state.controller.abort();
        for (const waiter of state.patchWaiters.values()) {
          waiter.reject(new Error("Workflow runtime closed"));
        }
        state.patchWaiters.clear();
        if (!runIsTerminal(runId)) {
          updateRunRuntimeState(runId, { canceled_at: new Date().toISOString(), waiting_for: null });
          deps.engine.updateRunStatus(runId, "canceled", undefined, "Workflow runtime closed.");
          emit({ type: "run_finished", runId, status: "canceled", errorMessage: "Workflow runtime closed." });
        }
      }
      running.clear();
    }
  };
}
