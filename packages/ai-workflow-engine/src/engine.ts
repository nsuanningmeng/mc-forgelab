import { randomUUID } from "node:crypto";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { Storage } from "@mc-forgelab/storage";
import { BUILTIN_WORKFLOWS } from "./builtin-workflows.js";
import type {
  WorkflowRecord, WorkflowRunRecord, WorkflowStepRecord,
  WorkflowDefinition, WorkflowRunStatus, WorkflowStepStatus, StepRole
} from "./types.js";

export interface WorkflowEngine {
  listWorkflows(): WorkflowRecord[];
  getWorkflow(id: string): WorkflowRecord;
  createWorkflow(def: WorkflowDefinition): WorkflowRecord;
  deleteWorkflow(id: string): void;

  createRun(workflowId: string, userPrompt: string, projectId?: string, providerId?: string, model?: string): WorkflowRunRecord;
  getRun(runId: string): WorkflowRunRecord;
  listRuns(workflowId?: string): WorkflowRunRecord[];
  updateRunStatus(runId: string, status: WorkflowRunStatus, summary?: string, errorMessage?: string): void;

  createStep(runId: string, stepId: string, role: StepRole, modelProfile?: string): WorkflowStepRecord;
  getStep(stepId: string): WorkflowStepRecord;
  listSteps(runId: string): WorkflowStepRecord[];
  updateStepStatus(id: string, status: WorkflowStepStatus, opts?: { outputSummary?: string; inputTokens?: number; outputTokens?: number; errorMessage?: string }): void;

  seedBuiltins(): void;
}

export function createWorkflowEngine(storage: Storage): WorkflowEngine {
  function rowToWorkflow(row: Record<string, unknown>): WorkflowRecord {
    return {
      id: row.id as string, name: row.name as string,
      mode: row.mode as WorkflowRecord["mode"],
      definitionJson: row.definition_json as string,
      builtin: (row.builtin as number) === 1,
      createdAt: row.created_at as string, updatedAt: row.updated_at as string
    };
  }

  function rowToRun(row: Record<string, unknown>): WorkflowRunRecord {
    return {
      id: row.id as string, workflowId: row.workflow_id as string,
      projectId: (row.project_id as string | null) ?? null,
      userPrompt: row.user_prompt as string,
      status: row.status as WorkflowRunStatus,
      startedAt: row.started_at as string, finishedAt: (row.finished_at as string | null) ?? null,
      selectedProviderId: (row.selected_provider_id as string | null) ?? null,
      selectedModel: (row.selected_model as string | null) ?? null,
      summary: (row.summary as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null
    };
  }

  function rowToStep(row: Record<string, unknown>): WorkflowStepRecord {
    return {
      id: row.id as string, runId: row.run_id as string, stepId: row.step_id as string,
      role: row.role as StepRole, modelProfile: (row.model_profile as string | null) ?? null,
      providerId: (row.provider_id as string | null) ?? null, model: (row.model as string | null) ?? null,
      status: row.status as WorkflowStepStatus,
      startedAt: row.started_at as string, finishedAt: (row.finished_at as string | null) ?? null,
      inputSummary: (row.input_summary as string | null) ?? null,
      outputSummary: (row.output_summary as string | null) ?? null,
      tokenUsageInput: (row.token_usage_input as number) ?? 0,
      tokenUsageOutput: (row.token_usage_output as number) ?? 0,
      costEstimate: (row.cost_estimate as number) ?? 0,
      errorMessage: (row.error_message as string | null) ?? null
    };
  }

  return {
    listWorkflows() {
      return storage.backend.all<Record<string, unknown>>("SELECT * FROM ai_workflows ORDER BY builtin DESC, created_at").map(rowToWorkflow);
    },

    getWorkflow(id) {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflows WHERE id = ?", [id]);
      if (!row) throw new AppError(ErrorCode.AI_WORKFLOW_NOT_FOUND, { details: { id } });
      return rowToWorkflow(row);
    },

    createWorkflow(def) {
      const now = new Date().toISOString();
      storage.backend.run(
        "INSERT INTO ai_workflows (id, name, mode, definition_json, builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [def.id, def.name, def.mode, JSON.stringify(def), 0, now, now]
      );
      return this.getWorkflow(def.id);
    },

    deleteWorkflow(id) {
      const wf = this.getWorkflow(id);
      if (wf.builtin) throw new AppError(ErrorCode.API_FORBIDDEN, { details: { reason: "Cannot delete builtin workflow" } });
      storage.backend.run("DELETE FROM ai_workflows WHERE id = ?", [id]);
    },

    createRun(workflowId, userPrompt, projectId, providerId, model) {
      this.getWorkflow(workflowId);
      const id = randomUUID();
      const now = new Date().toISOString();
      storage.backend.run(
        "INSERT INTO ai_workflow_runs (id, workflow_id, project_id, user_prompt, status, started_at, selected_provider_id, selected_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, workflowId, projectId ?? null, userPrompt, "pending", now, providerId ?? null, model ?? null]
      );
      return this.getRun(id);
    },

    getRun(runId) {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE id = ?", [runId]);
      if (!row) throw new AppError(ErrorCode.AI_WORKFLOW_RUN_NOT_FOUND, { details: { runId } });
      return rowToRun(row);
    },

    listRuns(workflowId) {
      const rows = workflowId
        ? storage.backend.all<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC", [workflowId])
        : storage.backend.all<Record<string, unknown>>("SELECT * FROM ai_workflow_runs ORDER BY started_at DESC");
      return rows.map(rowToRun);
    },

    updateRunStatus(runId, status, summary, errorMessage) {
      const now = new Date().toISOString();
      const finished = ["success", "failed", "canceled"].includes(status) ? now : null;
      const result = storage.backend.run(
        "UPDATE ai_workflow_runs SET status=?, finished_at=?, summary=?, error_message=? WHERE id=?",
        [status, finished, summary ?? null, errorMessage ?? null, runId]
      );
      if (result.changes === 0) throw new AppError(ErrorCode.AI_WORKFLOW_RUN_NOT_FOUND, { details: { runId } });
    },

    createStep(runId, stepId, role, modelProfile) {
      const id = randomUUID();
      const now = new Date().toISOString();
      storage.backend.run(
        "INSERT INTO ai_workflow_steps (id, run_id, step_id, role, model_profile, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, runId, stepId, role, modelProfile ?? null, "pending", now]
      );
      return this.getStep(id);
    },

    getStep(id) {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_steps WHERE id = ?", [id]);
      if (!row) throw new AppError(ErrorCode.AI_WORKFLOW_STEP_FAILED, { details: { id } });
      return rowToStep(row);
    },

    listSteps(runId) {
      return storage.backend.all<Record<string, unknown>>("SELECT * FROM ai_workflow_steps WHERE run_id = ? ORDER BY started_at", [runId]).map(rowToStep);
    },

    updateStepStatus(id, status, opts = {}) {
      const now = new Date().toISOString();
      const finished = ["success", "failed", "skipped"].includes(status) ? now : null;
      const result = storage.backend.run(
        "UPDATE ai_workflow_steps SET status=?, finished_at=?, output_summary=?, token_usage_input=?, token_usage_output=?, error_message=? WHERE id=?",
        [status, finished, opts.outputSummary ?? null, opts.inputTokens ?? 0, opts.outputTokens ?? 0, opts.errorMessage ?? null, id]
      );
      if (result.changes === 0) throw new AppError(ErrorCode.AI_WORKFLOW_STEP_FAILED, { details: { id, reason: "not found" } });
    },

    seedBuiltins() {
      for (const def of BUILTIN_WORKFLOWS) {
        const existing = storage.backend.get("SELECT id FROM ai_workflows WHERE id = ?", [def.id]);
        if (!existing) {
          const now = new Date().toISOString();
          storage.backend.run(
            "INSERT INTO ai_workflows (id, name, mode, definition_json, builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [def.id, def.name, def.mode, JSON.stringify(def), 1, now, now]
          );
        }
      }
    }
  };
}
