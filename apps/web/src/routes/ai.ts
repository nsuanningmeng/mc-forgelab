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

  app.get<{ Params: { runId: string } }>(
    "/api/ai/workflow-runs/:runId/stream",
    async (req, reply) => {
      const run = ctx.storage.backend.get("SELECT * FROM ai_workflow_runs WHERE id = ?", [req.params.runId]);
      if (!run) return reply.status(404).send({ error: "Run not found" });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const steps = ctx.storage.backend.all("SELECT * FROM ai_workflow_steps WHERE run_id = ? ORDER BY started_at", [req.params.runId]);
      for (const step of steps) {
        reply.raw.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
      }
      reply.raw.write(`data: ${JSON.stringify({ type: "run", run })}\n\n`);
      reply.raw.end();
    }
  );
}
