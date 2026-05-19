import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { AppError } from "@mc-forgelab/app-error";

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
        triggerType: "manual"
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
}
