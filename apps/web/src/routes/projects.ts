import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { randomUUID } from "node:crypto";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";

const VALID_TARGETS = new Set(["paper","spigot","purpur","folia","velocity","bungeecord","fabric","forge","neoforge","quilt"]);
const MC_VERSION_RE = /^\d+\.\d+(\.\d+)?$/;
const PKG_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export async function registerProjectRoutes(app: FastifyInstance, ctx: AppContext) {
  const targetRegistry = createDefaultRegistry();

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

  app.post<{ Body: { name?: string; targetId?: string; minecraftVersion?: string; packageName?: string } }>(
    "/api/projects",
    async (req, reply) => {
      const { name, targetId = "paper", minecraftVersion = "1.20.1", packageName = "com.example.plugin" } = req.body ?? {};
      if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 128)
        return reply.status(400).send({ error: "name is required (1-128 chars)" });
      if (typeof targetId !== "string" || !VALID_TARGETS.has(targetId))
        return reply.status(400).send({ error: `targetId must be one of: ${[...VALID_TARGETS].join(", ")}` });
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
    ctx.storage.backend.run("DELETE FROM projects WHERE id = ?", [req.params.id]);
    ctx.auditor.log({ eventType: "project.delete", entityType: "project", entityId: req.params.id });
    return reply.status(204).send();
  });
}
