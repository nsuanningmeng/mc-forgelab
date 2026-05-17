import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { AppError } from "@mc-forgelab/app-error";

export async function registerArtifactRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Params: { id: string } }>("/api/projects/:id/artifacts", async (req) => {
    return ctx.artifacts.list(req.params.id);
  });

  app.get<{ Params: { id: string; artifactId: string } }>(
    "/api/projects/:id/artifacts/:artifactId/download",
    async (req, reply) => {
      try {
        const dl = await ctx.artifacts.openDownload(req.params.artifactId, ctx.cfg.paths.workspace);
        // IDOR check: artifact must belong to the requested project
        if (dl.record.projectId !== req.params.id) return reply.status(403).send({ error: "Forbidden" });
        reply.header("Content-Disposition", dl.contentDisposition);
        reply.header("Content-Type", dl.contentType);
        reply.header("Content-Length", dl.contentLength);
        reply.header("X-SHA256", dl.sha256);
        return reply.send(dl.stream);
      } catch (e) {
        if (e instanceof AppError) return reply.status(e.httpStatus).send({ error: e.messageEn });
        throw e;
      }
    }
  );

  app.delete<{ Params: { id: string; artifactId: string } }>(
    "/api/projects/:id/artifacts/:artifactId",
    async (req, reply) => {
      const record = await ctx.artifacts.get(req.params.artifactId);
      if (record.projectId !== req.params.id) return reply.status(403).send({ error: "Forbidden" });
      await ctx.artifacts.delete(req.params.artifactId, ctx.cfg.paths.workspace);
      return reply.status(204).send();
    }
  );
}
