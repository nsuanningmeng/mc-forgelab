import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";

function parseLimit(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 200;
  if (!Number.isFinite(n)) return 200;
  return Math.max(1, Math.min(500, n));
}

export async function registerAuditRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: { limit?: string } }>("/api/audit", async (req) => {
    const limit = parseLimit(req.query.limit);
    return ctx.storage.backend.all(
      "SELECT id, event_type, entity_type, entity_id, payload_json, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
  });
}
