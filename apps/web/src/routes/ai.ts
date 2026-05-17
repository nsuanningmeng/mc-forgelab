import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";

export async function registerAIRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/ai/providers", async () => {
    return ctx.storage.backend.all("SELECT id, display_name, type, base_url, default_model, enabled, created_at FROM ai_providers ORDER BY created_at");
  });

  app.get("/api/ai/workflows", async () => {
    return ctx.storage.backend.all("SELECT id, name, mode, builtin, created_at FROM ai_workflows ORDER BY builtin DESC, created_at");
  });

  app.get("/api/ai/workflow-runs", async () => {
    return ctx.storage.backend.all("SELECT * FROM ai_workflow_runs ORDER BY started_at DESC LIMIT 50");
  });

  // SSE: workflow run stream
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
