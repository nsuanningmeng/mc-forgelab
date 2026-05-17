import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { randomUUID } from "node:crypto";

export async function registerProjectRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/projects", async () => {
    return ctx.storage.backend.all("SELECT * FROM projects ORDER BY created_at DESC");
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const row = ctx.storage.backend.get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!row) return reply.status(404).send({ error: "Project not found" });
    return row;
  });

  app.post<{ Body: { name?: string; targetId?: string; minecraftVersion?: string; packageName?: string } }>(
    "/api/projects",
    async (req, reply) => {
      const { name, targetId = "paper", minecraftVersion = "1.20.1", packageName = "com.example.plugin" } = req.body ?? {};
      if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 128) {
        return reply.status(400).send({ error: "name is required (1-128 chars)" });
      }
      const id = randomUUID();
      const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const now = new Date().toISOString();
      ctx.storage.backend.run(
        "INSERT INTO projects (id, name, slug, type, target_id, minecraft_version, java_version, build_tool, package_name, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, slug, "plugin", targetId, minecraftVersion, 17, "gradle", packageName, "", now, now]
      );
      return reply.status(201).send(ctx.storage.backend.get("SELECT * FROM projects WHERE id = ?", [id]));
    }
  );

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    ctx.storage.backend.run("DELETE FROM projects WHERE id = ?", [req.params.id]);
    return reply.status(204).send();
  });
}
