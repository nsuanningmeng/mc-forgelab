import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { AppError } from "@mc-forgelab/app-error";
import type { ModelProfileRecord, ModelRole } from "@mc-forgelab/ai-provider-manager";

function serializeProvider(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    type: row.type as string,
    baseUrl: row.base_url as string,
    defaultModel: row.default_model as string,
    enabled: (row.enabled as number) === 1,
    hasKey: typeof row.api_key_encrypted === "string" && (row.api_key_encrypted as string).length > 0,
    createdAt: row.created_at as string,
  };
}

function validateProviderInput(body: {
  displayName?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  defaultModel?: unknown;
  timeoutMs?: unknown;
  enabled?: unknown;
}, mode: "create" | "update"): string | null {
  const isStr = (v: unknown): v is string => typeof v === "string";
  const has = (k: keyof typeof body): boolean => body[k] !== undefined;

  if (mode === "create" || has("displayName")) {
    if (!isStr(body.displayName) || body.displayName.trim().length === 0 || body.displayName.length > 128) {
      return "displayName is required (1-128 chars)";
    }
  }
  if (mode === "create" || has("baseUrl")) {
    if (!isStr(body.baseUrl) || !/^https?:\/\//.test(body.baseUrl)) {
      return "baseUrl must be a valid http(s) URL";
    }
  }
  if (mode === "create") {
    if (!isStr(body.apiKey) || body.apiKey.length < 4) return "apiKey is required";
  } else if (has("apiKey")) {
    if (!isStr(body.apiKey) || body.apiKey.length < 4) return "apiKey must be at least 4 chars";
  }
  if (mode === "create" || has("defaultModel")) {
    if (!isStr(body.defaultModel) || body.defaultModel.trim().length === 0) {
      return "defaultModel is required";
    }
  }
  if (has("timeoutMs")) {
    if (typeof body.timeoutMs !== "number" || !Number.isFinite(body.timeoutMs) || body.timeoutMs < 1000 || body.timeoutMs > 600_000) {
      return "timeoutMs must be a number between 1000 and 600000";
    }
  }
  if (has("enabled")) {
    if (typeof body.enabled !== "boolean") return "enabled must be a boolean";
  }
  return null;
}

const API_MODEL_PROFILE_ROLES = [
  "generalModel",
  "plannerModel",
  "architectModel",
  "codeModel",
  "reviewModel",
  "fixModel",
  "docModel",
  "summarizerModel"
] as const;

type ApiModelProfileRole = (typeof API_MODEL_PROFILE_ROLES)[number];

const PROFILE_ROLE_SET = new Set<string>(API_MODEL_PROFILE_ROLES);

const API_TO_MODEL_ROLE: Record<ApiModelProfileRole, ModelRole> = {
  generalModel: "general",
  plannerModel: "planner",
  architectModel: "architect",
  codeModel: "coder",
  reviewModel: "reviewer",
  fixModel: "fixer",
  docModel: "docs",
  summarizerModel: "summarizer"
};

const MODEL_TO_API_ROLE: Record<ModelRole, ApiModelProfileRole> = {
  general: "generalModel",
  planner: "plannerModel",
  architect: "architectModel",
  coder: "codeModel",
  reviewer: "reviewModel",
  fixer: "fixModel",
  docs: "docModel",
  summarizer: "summarizerModel"
};

const PROFILE_CREATE_KEYS = new Set([
  "name",
  "providerId",
  "model",
  "role",
  "temperature",
  "maxTokens",
  "topP",
  "timeoutMs",
  "systemPrompt",
  "enabled"
]);

const PROFILE_UPDATE_KEYS = new Set([
  "name",
  "providerId",
  "model",
  "role",
  "temperature",
  "maxTokens",
  "topP",
  "timeoutMs",
  "systemPrompt",
  "enabled"
]);

interface NormalizedProfileInput {
  name?: string;
  providerId?: string;
  model?: string;
  role?: ModelRole;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  enabled?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function serializeModelProfile(profile: ModelProfileRecord) {
  return {
    ...profile,
    role: MODEL_TO_API_ROLE[profile.role]
  };
}

function validateNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  integer = false
): string | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    return `${field} must be a ${integer ? "integer" : "number"} between ${min} and ${max}`;
  }
  return null;
}

function validateProfileInput(body: unknown, mode: "create" | "update"): { input?: NormalizedProfileInput; error?: string } {
  if (!isRecord(body)) return { error: "Body must be an object" };

  const allowed = mode === "create" ? PROFILE_CREATE_KEYS : PROFILE_UPDATE_KEYS;
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { error: `${key} is not allowed` };
  }
  if (mode === "update" && Object.keys(body).length === 0) {
    return { error: "At least one field is required" };
  }

  const input: NormalizedProfileInput = {};

  if (mode === "create" || hasOwn(body, "name")) {
    if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 128) {
      return { error: "name is required (1-128 chars)" };
    }
    input.name = body.name.trim();
  }

  if (mode === "create" || hasOwn(body, "providerId")) {
    if (typeof body.providerId !== "string" || body.providerId.trim().length < 1 || body.providerId.trim().length > 128) {
      return { error: "providerId is required (1-128 chars)" };
    }
    input.providerId = body.providerId.trim();
  }

  if (mode === "create" || hasOwn(body, "model")) {
    if (typeof body.model !== "string" || body.model.trim().length < 1 || body.model.trim().length > 128) {
      return { error: "model is required (1-128 chars)" };
    }
    input.model = body.model.trim();
  }

  if (mode === "create" || hasOwn(body, "role")) {
    if (typeof body.role !== "string" || !PROFILE_ROLE_SET.has(body.role)) {
      return { error: `role must be one of: ${API_MODEL_PROFILE_ROLES.join(", ")}` };
    }
    input.role = API_TO_MODEL_ROLE[body.role as ApiModelProfileRole];
  }

  if (hasOwn(body, "temperature")) {
    const err = validateNumber(body.temperature, "temperature", 0, 2);
    if (err) return { error: err };
    input.temperature = body.temperature as number;
  }

  if (hasOwn(body, "maxTokens")) {
    const err = validateNumber(body.maxTokens, "maxTokens", 1, 200_000, true);
    if (err) return { error: err };
    input.maxTokens = body.maxTokens as number;
  }

  if (hasOwn(body, "topP")) {
    const err = validateNumber(body.topP, "topP", 0, 1);
    if (err) return { error: err };
    input.topP = body.topP as number;
  }

  if (hasOwn(body, "timeoutMs")) {
    const err = validateNumber(body.timeoutMs, "timeoutMs", 1000, 600_000, true);
    if (err) return { error: err };
    input.timeoutMs = body.timeoutMs as number;
  }

  if (hasOwn(body, "systemPrompt")) {
    if (typeof body.systemPrompt !== "string") return { error: "systemPrompt must be a string" };
    input.systemPrompt = body.systemPrompt;
  }

  if (hasOwn(body, "enabled")) {
    if (typeof body.enabled !== "boolean") return { error: "enabled must be a boolean" };
    input.enabled = body.enabled;
  }

  return { input };
}

function setProfileEnabled(ctx: AppContext, id: string, enabled: boolean): void {
  ctx.storage.backend.run(
    "UPDATE model_profiles SET enabled = ?, updated_at = ? WHERE id = ?",
    [enabled ? 1 : 0, new Date().toISOString(), id]
  );
}

function profileUpdatePayload(input: NormalizedProfileInput) {
  return {
    name: input.name,
    providerId: input.providerId,
    model: input.model,
    role: input.role,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    topP: input.topP,
    timeoutMs: input.timeoutMs,
    systemPrompt: input.systemPrompt,
  };
}

const MAX_HISTORY_CONTEXT_RUNS = 5;
const MAX_HISTORY_SUMMARY_CHARS = 2000;

interface WorkflowHistoryRun {
  readonly id: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly summary: string | null;
}

function truncateHistorySummary(summary: string): string {
  if (summary.length <= MAX_HISTORY_SUMMARY_CHARS) return summary;
  return `${summary.slice(0, MAX_HISTORY_SUMMARY_CHARS)}\n[truncated]`;
}

function buildWorkflowHistoryContext(ctx: AppContext, projectId: string | undefined) {
  if (!projectId) return [];

  const rows = ctx.storage.backend.all<WorkflowHistoryRun>(
    `SELECT id, started_at, finished_at, summary
     FROM ai_workflow_runs
     WHERE project_id = ?
       AND status = 'success'
       AND summary IS NOT NULL
       AND length(trim(summary)) > 0
     ORDER BY COALESCE(finished_at, started_at) DESC
     LIMIT ?`,
    [projectId, MAX_HISTORY_CONTEXT_RUNS]
  );
  if (rows.length === 0) return [];

  const content = rows.map((row, index) =>
    `#${index + 1} run=${row.id} finished=${row.finished_at ?? row.started_at}\n${truncateHistorySummary((row.summary ?? "").trim())}`
  ).join("\n\n");
  return [{ role: "system" as const, content: `Previous successful workflow summaries for this project, newest first. Use them only as background context; the current user request has priority.\n\n${content}` }];
}

function runSnapshot(ctx: AppContext, runId: string) {
  const run = ctx.storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE id = ?", [runId]);
  if (!run) return null;
  const steps = ctx.storage.backend.all<Record<string, unknown>>(
    "SELECT * FROM ai_workflow_steps WHERE run_id = ? ORDER BY sequence",
    [runId]
  );
  const snapshot: Record<string, unknown> & {
    steps: Record<string, unknown>[];
    pending_confirmation: boolean;
  } = {
    ...run,
    steps,
    pending_confirmation: Boolean(run.waiting_for)
  };
  return snapshot;
}

function isTerminalStatus(status: unknown): boolean {
  return status === "success" || status === "failed" || status === "canceled";
}

export async function registerAIRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/ai/providers", async () => {
    const rows = ctx.storage.backend.all<Record<string, unknown>>(
      "SELECT id, display_name, type, base_url, default_model, enabled, api_key_encrypted, created_at FROM ai_providers ORDER BY created_at"
    );
    return rows.map(serializeProvider);
  });

  app.post<{ Body: {
    displayName?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
    timeoutMs?: number;
    enabled?: boolean;
  } }>(
    "/api/ai/providers",
    async (req, reply) => {
      const body = req.body ?? {};
      const err = validateProviderInput(body, "create");
      if (err) return reply.status(400).send({ error: err });
      try {
        const created = ctx.providers.createProvider({
          displayName: (body.displayName as string).trim(),
          baseUrl: (body.baseUrl as string).trim(),
          apiKey: body.apiKey as string,
          defaultModel: (body.defaultModel as string).trim(),
          timeoutMs: body.timeoutMs,
          enabled: body.enabled !== false,
        });
        ctx.auditor.log({
          eventType: "provider.create",
          entityType: "provider",
          entityId: created.id,
          payload: {
            displayName: created.displayName,
            baseUrl: created.baseUrl,
            defaultModel: created.defaultModel,
            enabled: created.enabled
          }
        });
        const row = ctx.storage.backend.get<Record<string, unknown>>(
          "SELECT id, display_name, type, base_url, default_model, enabled, api_key_encrypted, created_at FROM ai_providers WHERE id = ?",
          [created.id]
        );
        return reply.status(201).send(row ? serializeProvider(row) : null);
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: {
    displayName?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
    timeoutMs?: number;
    enabled?: boolean;
  } }>(
    "/api/ai/providers/:id",
    async (req, reply) => {
      const body = req.body ?? {};
      const err = validateProviderInput(body, "update");
      if (err) return reply.status(400).send({ error: err });
      try {
        const payload: typeof body = { ...body };
        if (typeof payload.displayName === "string") payload.displayName = payload.displayName.trim();
        if (typeof payload.baseUrl === "string") payload.baseUrl = payload.baseUrl.trim();
        if (typeof payload.defaultModel === "string") payload.defaultModel = payload.defaultModel.trim();
        const updated = ctx.providers.updateProvider(req.params.id, payload);
        ctx.auditor.log({
          eventType: "provider.update",
          entityType: "provider",
          entityId: req.params.id,
          payload: {
            displayName: updated.displayName,
            baseUrl: updated.baseUrl,
            defaultModel: updated.defaultModel,
            enabled: updated.enabled
          }
        });
        const row = ctx.storage.backend.get<Record<string, unknown>>(
          "SELECT id, display_name, type, base_url, default_model, enabled, api_key_encrypted, created_at FROM ai_providers WHERE id = ?",
          [req.params.id]
        );
        return row ? serializeProvider(row) : reply.status(404).send({ error: "Provider not found" });
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/ai/providers/:id",
    async (req, reply) => {
      try {
        ctx.providers.deleteProvider(req.params.id);
        ctx.auditor.log({ eventType: "provider.delete", entityType: "provider", entityId: req.params.id });
        return reply.status(204).send();
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/ai/providers/:id/test",
    async (req, reply) => {
      try {
        const result = await ctx.providers.testProvider(req.params.id);
        return result;
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.get<{ Params: { id: string } }>(
    "/api/ai/providers/:id/models",
    async (req, reply) => {
      try {
        const models = await ctx.providers.listModels(req.params.id);
        return models;
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.get("/api/ai/workflows", async () => {
    return ctx.storage.backend.all("SELECT id, name, mode, builtin, created_at FROM ai_workflows ORDER BY builtin DESC, created_at");
  });

  app.get("/api/ai/workflow-runs", async () => {
    return ctx.storage.backend.all("SELECT * FROM ai_workflow_runs ORDER BY started_at DESC LIMIT 50");
  });

  app.post<{ Body: {
    workflowId?: string;
    prompt?: string;
    projectId?: string;
    providerId?: string;
    model?: string;
    settings?: { patchReview?: boolean };
  } }>(
    "/api/ai/workflow-runs",
    async (req, reply) => {
      const body = req.body ?? {};
      if (typeof body.workflowId !== "string" || body.workflowId.trim().length === 0) {
        return reply.status(400).send({ error: "workflowId is required" });
      }
      if (typeof body.prompt !== "string" || body.prompt.trim().length < 1 || body.prompt.length > 8000) {
        return reply.status(400).send({ error: "prompt is required (1-8000 chars)" });
      }

      const workflow = ctx.storage.backend.get("SELECT id FROM ai_workflows WHERE id = ?", [body.workflowId]);
      if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

      if (body.projectId) {
        const project = ctx.storage.backend.get("SELECT id FROM projects WHERE id = ?", [body.projectId]);
        if (!project) return reply.status(404).send({ error: "Project not found" });

        const active = ctx.storage.backend.get(
          "SELECT id FROM ai_workflow_runs WHERE project_id = ? AND status IN ('pending', 'running', 'waiting_confirmation')",
          [body.projectId]
        );
        if (active) return reply.status(409).send({ error: "A workflow run is already active for this project" });
      }

      const result = await ctx.workflowRuntime.startRun({
        workflowId: body.workflowId,
        userPrompt: body.prompt,
        projectId: body.projectId,
        providerId: body.providerId,
        model: body.model,
        patchReviewEnabled: body.settings?.patchReview === true,
        triggerType: "manual",
        contextMessages: buildWorkflowHistoryContext(ctx, body.projectId)
      });
      return reply.status(202).send(result);
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/api/ai/workflow-runs/:runId",
    async (req, reply) => {
      const snapshot = runSnapshot(ctx, req.params.runId);
      if (!snapshot) return reply.status(404).send({ error: "Run not found" });
      return snapshot;
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/api/ai/workflow-runs/:runId/stream",
    async (req, reply) => {
      const snapshot = runSnapshot(ctx, req.params.runId);
      if (!snapshot) return reply.status(404).send({ error: "Run not found" });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let closed = false;
      let cleaned = false;
      const safeWrite = (chunk: string): boolean => {
        if (closed || reply.raw.writableEnded || reply.raw.destroyed) {
          closed = true;
          return false;
        }
        try {
          return reply.raw.write(chunk);
        } catch {
          closed = true;
          return false;
        }
      };
      const send = (event: { type: string; [k: string]: unknown }) => {
        safeWrite(`data: ${JSON.stringify(event)}\n\n`);
      };

      for (const event of ctx.workflowRuntime.loadRunEvents(req.params.runId)) {
        if (closed) break;
        send(event);
      }
      send({ type: "run_state", run: snapshot, steps: snapshot.steps });

      let unsubscribe: (() => void) | undefined;
      let ping: NodeJS.Timeout | undefined;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        closed = true;
        if (ping) clearInterval(ping);
        unsubscribe?.();
        try { reply.raw.end(); } catch { /* ignore */ }
      };

      if (snapshot.status === "running" || snapshot.status === "pending" || snapshot.status === "waiting_confirmation") {
        unsubscribe = ctx.workflowRuntime.subscribe(req.params.runId, (event) => {
          if (closed) {
            cleanup();
            return;
          }
          send(event);
          if (event.type === "run_finished") {
            cleanup();
          }
        });
      } else {
        send({ type: "done" });
        cleanup();
        return reply;
      }

      ping = setInterval(() => {
        if (closed) {
          cleanup();
          return;
        }
        safeWrite(`: ping\n\n`);
      }, 25_000);

      req.raw.on("close", cleanup);
      req.raw.on("error", cleanup);

      return reply;
    }
  );

  app.post<{ Params: { runId: string } }>(
    "/api/ai/workflow-runs/:runId/cancel",
    async (req, reply) => {
      const run = ctx.storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE id = ?", [req.params.runId]);
      if (!run) return reply.status(404).send({ error: "Run not found" });
      if (isTerminalStatus(run.status)) return reply.status(409).send({ error: "Run is already terminal" });

      const ok = await ctx.workflowRuntime.cancelRun(req.params.runId);
      if (!ok) return reply.status(409).send({ error: "Run could not be canceled" });
      return reply.status(202).send({ ok: true });
    }
  );

  app.post<{ Params: { runId: string }; Body: { fromStepId?: string } }>(
    "/api/ai/workflow-runs/:runId/retry",
    async (req, reply) => {
      if (typeof req.body?.fromStepId !== "string" || req.body.fromStepId.length === 0) {
        return reply.status(400).send({ error: "fromStepId is required" });
      }
      const run = ctx.storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE id = ?", [req.params.runId]);
      if (!run) return reply.status(404).send({ error: "Run not found" });

      const result = await ctx.workflowRuntime.retryRunFromStep(req.params.runId, req.body.fromStepId);
      return reply.status(202).send(result);
    }
  );

  app.post<{ Params: { runId: string }; Body: { decision?: "approve" | "reject"; editedPatch?: string } }>(
    "/api/ai/workflow-runs/:runId/confirm",
    async (req, reply) => {
      if (req.body?.decision !== "approve" && req.body?.decision !== "reject") {
        return reply.status(400).send({ error: "decision is required" });
      }

      const run = ctx.storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_workflow_runs WHERE id = ?", [req.params.runId]);
      if (!run) return reply.status(404).send({ error: "Run not found" });
      if (!run.waiting_for) return reply.status(409).send({ error: "Run is not waiting for confirmation" });

      await ctx.workflowRuntime.confirmPatch(req.params.runId, req.body.decision, req.body.editedPatch);
      return reply.status(202).send({ ok: true });
    }
  );

  app.get("/api/ai/model-profiles", async () => {
    return ctx.providers.listProfiles().map(serializeModelProfile);
  });

  app.get<{ Params: { id: string } }>(
    "/api/ai/model-profiles/:id",
    async (req, reply) => {
      try {
        return serializeModelProfile(ctx.providers.getProfile(req.params.id));
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.post<{ Body?: unknown }>(
    "/api/ai/model-profiles",
    async (req, reply) => {
      const validation = validateProfileInput(req.body ?? {}, "create");
      if (validation.error) return reply.status(400).send({ error: validation.error });
      const input = validation.input!;

      try {
        ctx.providers.getProvider(input.providerId as string);
      } catch (e) {
        if (e instanceof AppError) return reply.status(400).send({ error: e.messageEn, code: e.code });
        throw e;
      }

      try {
        let created = ctx.providers.createProfile({
          name: input.name as string,
          providerId: input.providerId as string,
          model: input.model as string,
          role: input.role as ModelRole,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          topP: input.topP,
          timeoutMs: input.timeoutMs,
          systemPrompt: input.systemPrompt,
        });

        if (input.enabled !== undefined && input.enabled !== created.enabled) {
          setProfileEnabled(ctx, created.id, input.enabled);
          created = ctx.providers.getProfile(created.id);
        }

        ctx.auditor.log({
          eventType: "model_profile.create",
          entityType: "model_profile",
          entityId: created.id,
          payload: {
            name: created.name,
            providerId: created.providerId,
            model: created.model,
            role: created.role,
            enabled: created.enabled
          }
        });

        return reply.status(201).send(serializeModelProfile(created));
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.patch<{ Params: { id: string }; Body?: unknown }>(
    "/api/ai/model-profiles/:id",
    async (req, reply) => {
      const validation = validateProfileInput(req.body ?? {}, "update");
      if (validation.error) return reply.status(400).send({ error: validation.error });
      const input = validation.input!;

      if (input.providerId) {
        try {
          ctx.providers.getProvider(input.providerId);
        } catch (e) {
          if (e instanceof AppError) return reply.status(400).send({ error: e.messageEn, code: e.code });
          throw e;
        }
      }

      try {
        let updated = ctx.providers.updateProfile(req.params.id, profileUpdatePayload(input));
        if (input.enabled !== undefined && input.enabled !== updated.enabled) {
          setProfileEnabled(ctx, req.params.id, input.enabled);
          updated = ctx.providers.getProfile(req.params.id);
        }

        ctx.auditor.log({
          eventType: "model_profile.update",
          entityType: "model_profile",
          entityId: req.params.id,
          payload: {
            name: updated.name,
            providerId: updated.providerId,
            model: updated.model,
            role: updated.role,
            enabled: updated.enabled
          }
        });

        return serializeModelProfile(updated);
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/ai/model-profiles/:id",
    async (req, reply) => {
      try {
        ctx.providers.deleteProfile(req.params.id);
        ctx.auditor.log({ eventType: "model_profile.delete", entityType: "model_profile", entityId: req.params.id });
        return reply.status(204).send();
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn, code: e.code });
        throw e;
      }
    }
  );
}
