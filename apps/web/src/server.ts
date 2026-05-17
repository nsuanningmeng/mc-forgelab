import Fastify from "fastify";
import cors from "@fastify/cors";
import { openStorage, BASE_MIGRATIONS, STAGE6_MIGRATIONS } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS } from "@mc-forgelab/ai-provider-manager";
import { STAGE3_MIGRATIONS } from "@mc-forgelab/ai-workflow-engine";
import { createArtifactManager } from "@mc-forgelab/artifact-manager";
import { loadConfig } from "@mc-forgelab/config";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerAIRoutes } from "./routes/ai.js";

export async function buildApp() {
  const cfg = loadConfig({ mode: "web" });
  const storage = await openStorage({
    backend: "auto",
    dbPath: cfg.paths.db,
    migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS, ...STAGE6_MIGRATIONS],
  });
  const artifacts = createArtifactManager(storage);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const ctx = { storage, artifacts, cfg };
  await registerProjectRoutes(app, ctx);
  await registerArtifactRoutes(app, ctx);
  await registerAIRoutes(app, ctx);

  app.get("/api/health", async () => ({ ok: true, version: "0.1.0" }));

  return { app, storage };
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const { app } = await buildApp();
  const cfg = loadConfig({ mode: "web" });
  await app.listen({ host: cfg.host, port: cfg.port });
}
