import { randomUUID } from "node:crypto";
import type { Storage } from "@mc-forgelab/storage";
import type { WorkflowEngine } from "./engine.js";
import type { StepRole, WorkflowDefinition, WorkflowRunStatus, WorkflowStepDef, WorkflowStepStatus } from "./types.js";
import { applyStepOutput, createContext, resolveStepInputs, type WorkflowContextSnapshot } from "./context.js";
import { createFakeProviderAdapter } from "./fake-provider-adapter.js";

type RuntimeRunStatus = WorkflowRunStatus | "waiting_confirmation";
type StepRuntimeStatus = "success" | "failed" | "skipped";

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

export function createWorkflowRuntime(deps: RuntimeDeps): WorkflowRuntime {
  const provider = createFakeProviderAdapter();
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

  async function runTool(step: WorkflowStepDef): Promise<unknown> {
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
        return "Patch applied successfully by the deterministic v0.3.0 stub.";
      case "system_build":
        return { status: "success" as const, log: "Fake build completed successfully." };
      case "system_package":
        return "Generated fake artifact: build/libs/forgelab-generated-0.3.0.jar";
      default:
        return "Tool completed successfully.";
    }
  }

  async function executeStep(runId: string, step: WorkflowStepDef, sequence: number, context: WorkflowContextSnapshot, signal: AbortSignal): Promise<void> {
    const started = Date.now();
    const stepRecord = deps.engine.createStep(runId, step.id, step.role, step.modelProfile);
    deps.storage.backend.run("UPDATE ai_workflow_steps SET sequence=?, provider_id=?, model=? WHERE id=?", [sequence, null, null, stepRecord.id]);
    deps.engine.updateStepStatus(stepRecord.id, "running");
    emit({ type: "step_started", runId, stepRowId: stepRecord.id, stepId: step.id, role: step.role, sequence });

    throwIfAborted(runId, signal);

    if (step.role === "auto_fix_loop") {
      const durationMs = Date.now() - started;
      deps.storage.backend.run("UPDATE ai_workflow_steps SET duration_ms=? WHERE id=?", [durationMs, stepRecord.id]);
      deps.engine.updateStepStatus(stepRecord.id, "skipped", { outputSummary: "Skipped because fake build succeeded." });
      emit({ type: "step_finished", runId, stepRowId: stepRecord.id, stepId: step.id, status: "skipped", outputSummary: "Skipped because fake build succeeded.", durationMs });
      return;
    }

    const inputs = resolveStepInputs(context, step.input);
    const inputSummary = summarize(inputs);
    deps.storage.backend.run("UPDATE ai_workflow_steps SET input_summary=? WHERE id=?", [inputSummary, stepRecord.id]);

    let value: unknown;
    let tokensIn = 0;
    let tokensOut = 0;

    if (isModelStep(step)) {
      emit({ type: "step_log", runId, stepRowId: stepRecord.id, line: `Invoking fake provider for ${step.role}.` });
      emit({ type: "step_log", runId, stepRowId: stepRecord.id, line: "Resolved deterministic step inputs." });
      const response = await provider.invoke(step.role, promptFromInputs(inputs), inputs);
      throwIfAborted(runId, signal);
      value = response.text;
      tokensIn = response.tokensIn;
      tokensOut = response.tokensOut;
      emit({ type: "model_delta", runId, stepRowId: stepRecord.id, chunk: response.text.slice(0, 160) });
    } else {
      value = await runTool(step);
      throwIfAborted(runId, signal);
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
          await executeStep(runId, step, startIndex + i + 1, context, signal);
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
