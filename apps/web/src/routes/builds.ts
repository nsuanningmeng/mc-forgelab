import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { join } from "node:path";

interface ProjectRow {
  id: string;
  project_path: string;
  java_version: number;
}

interface BuildEventRow {
  build_id: string;
  type: string;
  line: string | null;
  payload_json: string | null;
  created_at: string;
  sequence: number;
}

function serializeBuild(b: {
  buildId: string;
  projectId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  lines: string[];
  sourceHash?: string | null;
  cachedFromBuildId?: string | null;
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
    sourceHash: b.sourceHash ?? null,
    cachedFromBuildId: b.cachedFromBuildId ?? null,
    logPath: b.logPath,
  };
}

function isTerminalStatus(status: string): boolean {
  return status === "success" || status === "failed" || status === "canceled" || status === "interrupted" || status === "cached";
}

function loadBuildEventRows(ctx: AppContext, buildId: string): BuildEventRow[] {
  const rows = ctx.storage.backend.all<BuildEventRow>(
    "SELECT build_id, type, line, payload_json, created_at, sequence FROM build_events WHERE build_id = ? ORDER BY sequence",
    [buildId]
  );
  return rows
    .filter((row) => row.build_id === buildId)
    .sort((a, b) => a.sequence - b.sequence);
}

function parsePayload(payloadJson: string | null): unknown {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function serializeEventRow(row: BuildEventRow): { type: string; [k: string]: unknown } {
  const event: { type: string; [k: string]: unknown } = { type: row.type };
  if (typeof row.line === "string") event.line = row.line;

  const payload = parsePayload(row.payload_json);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    Object.assign(event, payload as Record<string, unknown>);
    event.type = row.type;
  } else if (payload !== null) {
    event.payload = payload;
  }

  return event;
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

  app.post<{ Params: { id: string }; Body?: { javaVersion?: 8 | 11 | 17 | 21; force?: boolean } }>(
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

      const entry = await ctx.builds.start({
        projectId: req.params.id,
        workspaceRoot,
        projectPath,
        javaVersion,
        logsDir: join(workspaceRoot, "logs"),
        force: req.body?.force === true,
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

      if (isTerminalStatus(entry.status) || entry.status !== "running") {
        for (const row of loadBuildEventRows(ctx, req.params.buildId)) {
          if (closed) break;
          send(serializeEventRow(row));
        }
        send({ type: "done" });
        closed = true;
        try { reply.raw.end(); } catch { /* ignore */ }
        return reply;
      }

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

      let unsubscribe: (() => void) | undefined;
      let ping: NodeJS.Timeout | undefined;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        unsubscribe?.();
        try { reply.raw.end(); } catch { /* ignore */ }
      };

      unsubscribe = ctx.builds.subscribe(req.params.buildId, (ev) => {
        if (closed) {
          cleanup();
          return;
        }
        send({ type: ev.type, line: ev.line, status: ev.status, errorSummary: ev.errorSummary, finishedAt: ev.finishedAt });
        if (ev.type === "done") {
          cleanup();
        }
      });

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
