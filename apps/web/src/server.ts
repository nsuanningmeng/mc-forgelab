import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openStorage, BASE_MIGRATIONS, STAGE6_MIGRATIONS } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS, createProviderManager } from "@mc-forgelab/ai-provider-manager";
import { STAGE3_MIGRATIONS, createWorkflowEngine, createWorkflowRuntime, BUILTIN_WORKFLOWS } from "@mc-forgelab/ai-workflow-engine";
import { applyMigration as applyKnowledgeMigration, STAGE7_MIGRATIONS } from "@mc-forgelab/knowledge-base";
import { createArtifactManager } from "@mc-forgelab/artifact-manager";
import { loadConfig, type AppConfig } from "@mc-forgelab/config";
import { AppError } from "@mc-forgelab/app-error";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerAIRoutes } from "./routes/ai.js";
import { registerToolchainRoutes } from "./routes/toolchains.js";
import { registerBuildRoutes } from "./routes/builds.js";
import { registerTargetRoutes } from "./routes/targets.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { createBuildRegistry } from "./lib/build-registry.js";
import { createAuditLogger, STAGE_WEB_MIGRATIONS } from "./lib/audit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_VERSION = readPackageVersion();

function readPackageVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.length > 0) return parsed.version;
  } catch {
    // Fall through to npm metadata for uncommon launchers that omit package.json.
  }
  return process.env.npm_package_version ?? "0.0.0";
}

export interface BuildAppOptions {
  /** Optional pre-resolved config. If omitted, buildApp resolves config
   *  itself with `loadConfig({ mode: "web" })`. The desktop / docker
   *  launchers MUST pass their own resolved cfg so per-mode data paths
   *  stay consistent. */
  cfg?: AppConfig;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const cfg = opts.cfg ?? loadConfig({ mode: "web" });
  // Surface the resolved DB path on startup so anyone can verify which
  // file the server actually opens. Mismatched modes between launcher
  // (desktop / docker / web) and the embedded server would otherwise
  // silently land in a different database.
  // eslint-disable-next-line no-console
  console.log(`[mc-forgelab] mode=${cfg.mode} db=${cfg.paths.db}`);
  // Persistence rule:
  // - Real on-disk paths require sqlite. Falling back to memory there
  //   would silently lose user data on every restart (this is the same
  //   failure mode behind "providers/projects disappear after upgrade"
  //   reports — a prebuilt binding that mismatches the host Node/
  //   Electron ABI). Hard-fail instead so the launcher can recover.
  // - The literal ":memory:" path is an explicit opt-in to ephemeral
  //   storage and is used by tests + ad-hoc demos.
  const wantsMemory = cfg.paths.db === ":memory:";
  const storage = await openStorage({
    backend: wantsMemory ? "memory" : "sqlite",
    dbPath: cfg.paths.db,
    migrations: [
      ...BASE_MIGRATIONS,
      ...STAGE2_MIGRATIONS,
      ...STAGE3_MIGRATIONS,
      ...STAGE6_MIGRATIONS,
      ...STAGE7_MIGRATIONS,
      ...STAGE_WEB_MIGRATIONS
    ],
  });
  // Report the backend actually selected so persistence regressions
  // are visible in startup logs and /api/health.
  // eslint-disable-next-line no-console
  console.log(`[mc-forgelab] storage.backend=${storage.backend.name}`);
  if (storage.backend.name === "memory") {
    // eslint-disable-next-line no-console
    console.warn(
      "[mc-forgelab] WARNING: running with in-memory storage; all data will be lost on restart. " +
      "This is expected when MC_FORGELAB_DB=:memory: (tests/demos)."
    );
  }
  applyKnowledgeMigration(storage);
  const artifacts = createArtifactManager(storage);
  const providers = createProviderManager(storage);
  const workflowEngine = createWorkflowEngine(storage);
  workflowEngine.seedBuiltins();
  const workflowRuntime = createWorkflowRuntime({
    storage,
    engine: workflowEngine,
    workflows: BUILTIN_WORKFLOWS
  });
  const builds = createBuildRegistry(storage);
  const auditor = createAuditLogger(storage);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: cfg.auth.enabled ? false : true });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    if (!req.url.startsWith("/api/")) return;
    if (!cfg.auth.enabled) return;
    const auth = req.headers.authorization ?? "";
    const [, b64] = auth.split(" ");
    const [user, pass] = Buffer.from(b64 ?? "", "base64").toString().split(":");
    const expectedUser = cfg.auth.adminUser ?? "";
    const expectedPass = process.env.MC_FORGELAB_ADMIN_PASSWORD ?? "";
    const { timingSafeEqual } = await import("node:crypto");
    const ok = user?.length === expectedUser.length && pass?.length === expectedPass.length
      && timingSafeEqual(Buffer.from(user), Buffer.from(expectedUser))
      && timingSafeEqual(Buffer.from(pass), Buffer.from(expectedPass));
    if (!ok) return reply.status(401).header("WWW-Authenticate", 'Basic realm="MC-AI-ForgeLab"').send({ error: "Unauthorized" });
  });
  await app.register(staticFiles, { root: join(__dirname, "..", "public"), prefix: "/", decorateReply: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.httpStatus).send({ error: err.messageEn, code: err.code });
    app.log.error(err);
    return reply.status(500).send({ error: "Internal server error" });
  });

  const ctx = { storage, artifacts, cfg, providers, workflowRuntime, builds, auditor };
  await registerProjectRoutes(app, ctx);
  await registerArtifactRoutes(app, ctx);
  await registerAIRoutes(app, ctx);
  await registerToolchainRoutes(app, ctx);
  await registerBuildRoutes(app, ctx);
  await registerTargetRoutes(app);
  await registerKnowledgeRoutes(app);
  await registerAuditRoutes(app, ctx);
  app.get("/api/health", async () => ({
    ok: true,
    version: APP_VERSION,
    storage: storage.backend.name,
    persistent: storage.backend.name === "sqlite",
  }));

  app.addHook("onClose", async () => {
    workflowRuntime.closeAll();
    builds.closeAll();
  });

  return { app, storage };
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const { app } = await buildApp();
  const cfg = loadConfig({ mode: "web" });
  await app.listen({ host: cfg.host, port: cfg.port });
}
