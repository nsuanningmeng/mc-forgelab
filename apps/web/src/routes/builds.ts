import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { join } from "node:path";

interface ProjectRow {
  id: string;
  project_path: string;
  java_version: number;
}

function serializeBuild(b: {
  buildId: string;
  projectId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  lines: string[];
  logPath: string | null;
}) {
  return {
    buildId: b.buildId,
    projectId: b.projectId,
    status: b.status,
    startedAt: b.startedAt,
    finishedAt: b.finishedAt,
    errorSummary: b.errorSummary,
    lineCount: b.lines.length,
    logPath: b.logPath,
  };
}

export async function registerBuildRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/builds",
    async (req, reply) => {
      const project = ctx.storage.backend.get<ProjectRow>(
        "SELECT id, project_path, java_version FROM projects WHERE id = ?", [req.params.id]
      );
      if (!project) return reply.status(404).send({ error: "Project not found" });
      return ctx.builds.list(req.params.id).map(serializeBuild);
    }
  );

  app.post<{ Params: { id: string }; Body?: { javaVersion?: 8 | 11 | 17 | 21 } }>(
    "/api/projects/:id/builds",
    async (req, reply) => {
      const project = ctx.storage.backend.get<ProjectRow>(
        "SELECT id, project_path, java_version FROM projects WHERE id = ?", [req.params.id]
      );
      if (!project) return reply.status(404).send({ error: "Project not found" });

      if (ctx.builds.hasActive(req.params.id)) {
        return reply.status(409).send({ error: "A build is already running for this project" });
      }

      const javaVersion = (req.body?.javaVersion ?? (project.java_version as 8 | 11 | 17 | 21));
      const workspaceRoot = ctx.cfg.paths.workspace;
      const projectPath = project.project_path && project.project_path.length > 0
        ? project.project_path
        : join(workspaceRoot, "projects", project.id);

      const entry = ctx.builds.start({
        projectId: req.params.id,
        workspaceRoot,
        projectPath,
        javaVersion,
        logsDir: join(workspaceRoot, "logs"),
      });

      ctx.auditor.log({
        eventType: "build.start",
        entityType: "build",
        entityId: entry.buildId,
        payload: { projectId: req.params.id, buildId: entry.buildId }
      });

      return reply.status(202).send(serializeBuild(entry));
    }
  );

  app.get<{ Params: { id: string; buildId: string } }>(
    "/api/projects/:id/builds/:buildId",
    async (req, reply) => {
      const entry = ctx.builds.get(req.params.buildId);
      if (!entry || entry.projectId !== req.params.id) {
        return reply.status(404).send({ error: "Build not found" });
      }
      return { ...serializeBuild(entry), lines: entry.lines.slice() };
    }
  );

  app.get<{ Params: { id: string; buildId: string } }>(
    "/api/projects/:id/builds/:buildId/stream",
    async (req, reply) => {
      const entry = ctx.builds.get(req.params.buildId);
      if (!entry || entry.projectId !== req.params.id) {
        return reply.status(404).send({ error: "Build not found" });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let closed = false;
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

      const replayStart = Math.max(0, entry.lines.length - 1000);
      for (let i = replayStart; i < entry.lines.length; i++) {
        if (closed) break;
        send({ type: "log", line: entry.lines[i] });
      }
      send({
        type: "status",
        status: entry.status,
        errorSummary: entry.errorSummary,
        finishedAt: entry.finishedAt,
      });

      if (entry.status !== "running" && entry.status !== "queued") {
        send({ type: "done" });
        try { reply.raw.end(); } catch { /* ignore */ }
        return reply;
      }

      const unsubscribe = ctx.builds.subscribe(req.params.buildId, (ev) => {
        if (closed) { unsubscribe(); return; }
        send({ type: ev.type, line: ev.line, status: ev.status, errorSummary: ev.errorSummary, finishedAt: ev.finishedAt });
        if (ev.type === "done") {
          cleanup();
        }
      });

      const ping = setInterval(() => {
        if (closed) { clearInterval(ping); return; }
        safeWrite(`: ping\n\n`);
      }, 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try { reply.raw.end(); } catch { /* ignore */ }
      };
      req.raw.on("close", cleanup);
      req.raw.on("error", cleanup);

      return reply;
    }
  );

  app.delete<{ Params: { id: string; buildId: string } }>(
    "/api/projects/:id/builds/:buildId",
    async (req, reply) => {
      const entry = ctx.builds.get(req.params.buildId);
      if (!entry || entry.projectId !== req.params.id) {
        return reply.status(404).send({ error: "Build not found" });
      }
      const ok = ctx.builds.cancel(req.params.buildId);
      if (!ok) return reply.status(409).send({ error: "Build is not running" });
      return reply.status(202).send({ canceled: true });
    }
  );
}
