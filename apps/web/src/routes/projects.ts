import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { randomUUID } from "node:crypto";
import { AppError } from "@mc-forgelab/app-error";
import { resolveContainedProjectPath } from "@mc-forgelab/ai-workflow-engine";
import { createFileOperationService } from "@mc-forgelab/file-operation";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";

const MC_VERSION_RE = /^\d+\.\d+(\.\d+)?$/;
const PKG_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const MAX_FILE_PATH_LENGTH = 2048;

interface ProjectFileRow {
  readonly id: string;
  readonly project_path: string | null;
}

export async function registerProjectRoutes(app: FastifyInstance, ctx: AppContext) {
  const targetRegistry = createDefaultRegistry();
  const files = createFileOperationService();
  // Derive valid target IDs from the registry so /api/projects accepts
  // every target that /api/targets exposes (previously hard-coded set
  // dropped bukkit/mohist/waterfall, which the UI happily offered then
  // rejected with HTTP 400 on submit).
  const validTargets = new Set(
    targetRegistry.list({ includeLegacy: true, includeDeprecated: true }).map((t) => t.id)
  );

  app.get("/api/projects", async () => {
    return ctx.storage.backend.all("SELECT * FROM projects ORDER BY created_at DESC");
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const row = ctx.storage.backend.get<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!row) return reply.status(404).send({ error: "Project not found" });

    const targetId = row.target_id as string;
    const target = targetRegistry.find(targetId);
    return {
      ...row,
      target: target
        ? {
            capabilities: target.capabilities,
            warningsZh: target.warningsZh,
            warningsEn: target.warningsEn,
            docsUrl: target.docsUrl,
            deprecated: target.deprecated,
            experimental: target.experimental
          }
        : {
            capabilities: null,
            warningsZh: ["Unknown target id"],
            warningsEn: ["Unknown target id"],
            docsUrl: null,
            deprecated: false,
            experimental: false
          }
    };
  });

  app.get<{ Params: { id: string; "*": string } }>("/api/projects/:id/files/*", async (req, reply) => {
    const filePath = req.params["*"];
    if (typeof filePath !== "string" || filePath.trim().length === 0 || filePath.length > MAX_FILE_PATH_LENGTH) {
      return reply.status(400).send({ error: `path is required (1-${MAX_FILE_PATH_LENGTH} chars)` });
    }

    const project = ctx.storage.backend.get<ProjectFileRow>(
      "SELECT id, project_path FROM projects WHERE id = ?",
      [req.params.id]
    );
    if (!project) return reply.status(404).send({ error: "Project not found" });

    try {
      const projectPath = resolveContainedProjectPath(ctx.cfg.paths.workspace, req.params.id, project.project_path);
      const content = files.readFile(projectPath, filePath);
      return {
        path: filePath,
        content,
        contentType: "text/plain; charset=utf-8"
      };
    } catch (e) {
      if (e instanceof AppError) throw e;
      return reply.status(400).send({
        error: e instanceof Error ? e.message : String(e)
      });
    }
  });

  app.post<{ Body: { name?: string; targetId?: string; minecraftVersion?: string; packageName?: string } }>(
    "/api/projects",
    async (req, reply) => {
      const { name, targetId = "paper", minecraftVersion = "1.20.1", packageName = "com.example.plugin" } = req.body ?? {};
      if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 128)
        return reply.status(400).send({ error: "name is required (1-128 chars)" });
      if (typeof targetId !== "string" || !validTargets.has(targetId))
        return reply.status(400).send({ error: `targetId must be one of: ${[...validTargets].join(", ")}` });
      if (typeof minecraftVersion !== "string" || !MC_VERSION_RE.test(minecraftVersion))
        return reply.status(400).send({ error: "minecraftVersion must match x.y or x.y.z" });
      if (typeof packageName !== "string" || !PKG_RE.test(packageName))
        return reply.status(400).send({ error: "packageName must be a valid Java package (e.g. com.example.plugin)" });
      const id = randomUUID();
      const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const now = new Date().toISOString();
      ctx.storage.backend.run(
        "INSERT INTO projects (id, name, slug, type, target_id, minecraft_version, java_version, build_tool, package_name, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name.trim(), slug, "plugin", targetId, minecraftVersion, 17, "gradle", packageName, "", now, now]
      );
      const created = ctx.storage.backend.get("SELECT * FROM projects WHERE id = ?", [id]);
      ctx.auditor.log({
        eventType: "project.create",
        entityType: "project",
        entityId: id,
        payload: { name: name.trim(), targetId }
      });
      return reply.status(201).send(created);
    }
  );

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const row = ctx.storage.backend.get("SELECT id FROM projects WHERE id = ?", [req.params.id]);
    if (!row) return reply.status(404).send({ error: "Project not found" });
    // Refuse while a build is still running — deleting now would orphan
    // the in-memory build process and any events it persists afterward.
    if (ctx.builds.hasActive(req.params.id)) {
      return reply.status(409).send({ error: "Cannot delete project while a build is running. Cancel the build first." });
    }
    ctx.storage.backend.run("DELETE FROM projects WHERE id = ?", [req.params.id]);
    ctx.auditor.log({ eventType: "project.delete", entityType: "project", entityId: req.params.id });
    return reply.status(204).send();
  });

  // ── Chat Messages ──────────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>("/api/projects/:id/messages", async (req, reply) => {
    const project = ctx.storage.backend.get("SELECT id FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const rows = ctx.storage.backend.all<{
      id: string; role: string; type: string; content: string;
      content_json: string | null; timestamp: string; sequence: number;
    }>(
      "SELECT id, role, type, content, content_json, timestamp, sequence FROM chat_messages WHERE project_id = ? ORDER BY sequence ASC",
      [req.params.id]
    );
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      type: r.type,
      content: r.type === "files" && r.content_json ? JSON.parse(r.content_json) : r.content,
      timestamp: r.timestamp,
      sequence: r.sequence
    }));
  });

  app.post<{ Params: { id: string }; Body: { messages?: unknown } }>(
    "/api/projects/:id/messages",
    async (req, reply) => {
      const project = ctx.storage.backend.get("SELECT id FROM projects WHERE id = ?", [req.params.id]);
      if (!project) return reply.status(404).send({ error: "Project not found" });
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      if (messages.length > 200) {
        return reply.status(400).send({ error: "Too many messages (max 200)" });
      }
      try {
        ctx.storage.backend.run("BEGIN");
        ctx.storage.backend.run("DELETE FROM chat_messages WHERE project_id = ?", [req.params.id]);
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          if (!m || typeof m.role !== "string" || typeof m.type !== "string") continue;
          const content = typeof m.content === "string" ? m.content : "";
          const contentJson = typeof m.content === "object" && m.content !== null ? JSON.stringify(m.content) : null;
          const timestamp = typeof m.timestamp === "string" ? m.timestamp : new Date().toISOString();
          const id = typeof m.id === "string" ? m.id : randomUUID();
          ctx.storage.backend.run(
            "INSERT INTO chat_messages (id, project_id, role, type, content, content_json, timestamp, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [id, req.params.id, m.role, m.type, content, contentJson, timestamp, i]
          );
        }
        ctx.storage.backend.run("COMMIT");
      } catch (e) {
        try { ctx.storage.backend.run("ROLLBACK"); } catch { /* ignore */ }
        throw e;
      }
      return reply.status(200).send({ ok: true, count: messages.length });
    }
  );
}
