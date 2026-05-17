import type { FastifyInstance } from "fastify";
import { getKnowledgeMatrix, search } from "@mc-forgelab/knowledge-base";

function mcMajor(version?: string): string | undefined {
  if (!version) return undefined;
  const parts = version.split(".");
  if (parts.length < 2) return version;
  return `${parts[0]}.${parts[1]}`;
}

export async function registerKnowledgeRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { target?: string; mcVersion?: string; topic?: string; q?: string } }>(
    "/api/knowledge/search",
    async (req) => {
      return search({
        targetId: req.query.target,
        mcMajor: mcMajor(req.query.mcVersion),
        topic: req.query.topic,
        q: req.query.q
      });
    }
  );

  app.get("/api/knowledge/matrix", async () => {
    return getKnowledgeMatrix();
  });
}
