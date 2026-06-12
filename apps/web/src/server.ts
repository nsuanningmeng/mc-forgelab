import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { openStorage, BASE_MIGRATIONS, STAGE6_MIGRATIONS, type Storage } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS, createProviderManager } from "@mc-forgelab/ai-provider-manager";
import { STAGE3_MIGRATIONS, createWorkflowEngine, createWorkflowRuntime, BUILTIN_WORKFLOWS, resolveContainedProjectPath, type BuildRunner, type PatchApplier, type WorkflowBuildResult } from "@mc-forgelab/ai-workflow-engine";
import { applyMigration as applyKnowledgeMigration, STAGE7_MIGRATIONS } from "@mc-forgelab/knowledge-base";
import { createArtifactManager } from "@mc-forgelab/artifact-manager";
import { loadConfig, type AppConfig } from "@mc-forgelab/config";
import { runBuild } from "@mc-forgelab/build-orchestrator";
import { renderTemplate } from "@mc-forgelab/template-engine";
import type { ProjectSpec } from "@mc-forgelab/project-model";
import { createFileOperationService, parseFilePatch } from "@mc-forgelab/file-operation";
import { AppError } from "@mc-forgelab/app-error";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerAIRoutes } from "./routes/ai.js";
import { registerToolchainRoutes } from "./routes/toolchains.js";
import { registerBuildRoutes } from "./routes/builds.js";
import { registerTargetRoutes } from "./routes/targets.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerSettingsRoutes, getWorkspaceSettings } from "./routes/settings.js";
import { verifyPassword } from "./lib/password.js";
import { registerProxyRoutes } from "./routes/proxy.js";
import { createBuildRegistry } from "./lib/build-registry.js";
import { createAuditLogger, STAGE_WEB_MIGRATIONS } from "./lib/audit.js";
import { applyToolchainProxyEnv } from "./lib/proxy-agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_VERSION = readPackageVersion();
const MAX_RAW_PATCH_BYTES = 1024 * 1024;
const ADMIN_PASSWORD_HASH_KEY = "auth.adminPasswordHash";

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.messageEn;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isToolchainUnavailableError(error: unknown): boolean {
  return /toolchain|jdk|java|gradle|JAVA_HOME|executable/i.test(errorMessage(error));
}

function createWorkflowBuildRunner(cfg: AppConfig, storage: Storage): BuildRunner {
  return {
    async run(input): Promise<WorkflowBuildResult> {
      const buildId = randomUUID();
      const startedAt = new Date().toISOString();
      const logPath = join(cfg.paths.workspace, "logs", `${buildId}.log`);

      // Read project metadata for the builds table record
      let targetId = "";
      let mcVersion = "";
      let javaVer: 8 | 11 | 17 | 21 = input.javaVersion ?? 17;
      let buildTool = "gradle";
      try {
        const row = storage.backend.get<{ target_id: string; minecraft_version: string; java_version: number; build_tool: string }>(
          "SELECT target_id, minecraft_version, java_version, build_tool FROM projects WHERE id = ?",
          [input.projectId]
        );
        if (row) {
          targetId = row.target_id;
          mcVersion = row.minecraft_version;
          if (row.java_version === 8 || row.java_version === 11 || row.java_version === 17 || row.java_version === 21) javaVer = row.java_version;
          buildTool = row.build_tool ?? "gradle";
        }
      } catch { /* project lookup is best-effort */ }

      storage.backend.run(
        "INSERT INTO builds (id, project_id, status, started_at, target_id, minecraft_version, java_version, build_tool, log_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [buildId, input.projectId, "running", startedAt, targetId, mcVersion, javaVer, buildTool, logPath]
      );

      try {
        applyToolchainProxyEnv(storage);
        const record = await runBuild(input.projectId, {
          workspaceRoot: cfg.paths.workspace,
          projectPath: input.projectPath,
          javaVersion: input.javaVersion,
          timeoutMs: input.timeoutMs,
          logsDir: join(cfg.paths.workspace, "logs"),
          signal: input.signal
        }, input.onLog);

        const status = record.status === "success"
          ? "success"
          : record.status === "canceled"
            ? "canceled"
            : "failed";

        storage.backend.run(
          "UPDATE builds SET status = ?, finished_at = ?, error_summary = ? WHERE id = ?",
          [status, new Date().toISOString(), record.errorSummary ?? null, buildId]
        );

        return {
          status,
          errorSummary: record.errorSummary,
          errorCode: status === "failed" ? "BUILD_FAILED" : status === "canceled" ? "CANCELED" : undefined,
          buildId,
          logPath
        };
      } catch (error) {
        const message = errorMessage(error);
        const status = input.signal.aborted ? "canceled" : "failed";
        const errorCode = input.signal.aborted ? "CANCELED" : isToolchainUnavailableError(error) ? "TOOLCHAIN_UNAVAILABLE" : "UNKNOWN";
        storage.backend.run(
          "UPDATE builds SET status = ?, finished_at = ?, error_summary = ? WHERE id = ?",
          [status, new Date().toISOString(), message, buildId]
        );
        return { status: status === "canceled" ? "canceled" : "failed", errorCode, errorSummary: message, buildId, logPath };
      }
    }
  };
}

function patchApplyError(message: string): { applied: number; errors: string[] } {
  return { applied: 0, errors: [message] };
}

interface LegacyFileEntry {
  readonly path: string;
  readonly content?: string;
}

interface LegacyPatchFormat {
  readonly files?: readonly LegacyFileEntry[];
}

function isLegacyPatchFormat(raw: unknown): raw is LegacyPatchFormat {
  return typeof raw === "object" && raw !== null && Array.isArray((raw as LegacyPatchFormat).files);
}

function normalizeToPatch(raw: unknown): unknown {
  if (isLegacyPatchFormat(raw)) {
    return {
      type: "file_patch",
      summary: "Generated patch",
      operations: (raw.files ?? []).map((f) => ({
        op: "create" as const,
        path: f.path,
        content: f.content ?? ""
      }))
    };
  }
  // Models often omit type/summary even when operations are well-formed —
  // default them instead of rejecting the whole patch.
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as { operations?: unknown }).operations)) {
    const obj = raw as Record<string, unknown>;
    return {
      ...obj,
      type: "file_patch",
      summary: typeof obj.summary === "string" ? obj.summary : "Generated patch"
    };
  }
  return raw;
}

function looksLikePatch(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { operations?: unknown; files?: unknown; type?: unknown };
  return Array.isArray(v.operations) || Array.isArray(v.files) || v.type === "file_patch";
}

function tryParseBalancedObject(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text.charAt(i);
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

/**
 * Real models wrap the JSON patch in prose or markdown fences instead of
 * returning bare JSON — extract the patch object from mixed output.
 */
export function extractPatchJson(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* mixed model output */ }
  const fence = /```(?:json)?\s*([\s\S]*?)```/g;
  for (let m = fence.exec(trimmed); m !== null; m = fence.exec(trimmed)) {
    try {
      const parsed = JSON.parse((m[1] ?? "").trim()) as unknown;
      if (looksLikePatch(parsed)) return parsed;
    } catch { /* try the next fenced block */ }
  }
  for (let idx = trimmed.indexOf("{"); idx !== -1; idx = trimmed.indexOf("{", idx + 1)) {
    const parsed = tryParseBalancedObject(trimmed, idx);
    if (parsed !== undefined && looksLikePatch(parsed)) return parsed;
  }
  throw new Error("Model output does not contain a valid JSON file patch.");
}

function createWorkflowPatchApplier(): PatchApplier {
  const files = createFileOperationService();
  return {
    async apply(input, options) {
      if (options?.signal?.aborted) {
        return patchApplyError("Patch apply aborted.");
      }
      const patchBytes = Buffer.byteLength(input.patch, "utf8");
      if (patchBytes > MAX_RAW_PATCH_BYTES) {
        return patchApplyError(`Patch payload too large: ${patchBytes} bytes (max ${MAX_RAW_PATCH_BYTES}).`);
      }
      const raw = extractPatchJson(input.patch);
      if (options?.signal?.aborted) {
        return patchApplyError("Patch apply aborted.");
      }
      const normalized = normalizeToPatch(raw);
      const parsed = parseFilePatch(normalized);
      return files.applyPatch(input.projectPath, parsed, options);
    }
  };
}

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
   *  itself from environment variables. Launchers may pass their own
   *  resolved cfg so per-mode data paths stay consistent. */
  cfg?: AppConfig;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const cfg = opts.cfg ?? loadConfig();
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
  // One-time backfill for databases created before role profiles were seeded
  // on provider creation: without any profile, every workflow run silently
  // fell back to the fake provider even though a real provider was configured.
  try {
    if (providers.listProfiles().length === 0) {
      const firstEnabled = providers.listProviders().find((p) => p.enabled);
      if (firstEnabled) providers.ensureDefaultProfiles(firstEnabled.id, firstEnabled.defaultModel);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[mc-forgelab] model profile backfill skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
  const workflowEngine = createWorkflowEngine(storage);
  workflowEngine.seedBuiltins();
  const buildRunner = createWorkflowBuildRunner(cfg, storage);
  const patchApplier = createWorkflowPatchApplier();
  const builds = createBuildRegistry(storage);

  function resolveTemplateId(targetId: string): string {
    // Map target platform to template. Paper forks share plugin-paper-java;
    // Fabric/Quilt share mod-fabric-java; Velocity/Waterfall share plugin-velocity-java.
    const paperForks = new Set(["paper", "purpur", "folia", "bukkit", "spigot"]);
    const fabricMods = new Set(["fabric", "quilt"]);
    const velocityProxies = new Set(["velocity", "waterfall"]);
    if (fabricMods.has(targetId)) return "mod-fabric-java";
    if (velocityProxies.has(targetId)) return "plugin-velocity-java";
    return "plugin-paper-java"; // default for paper forks, forge, neoforge, bungeecord, etc.
  }

  function isJavaVersion(v: number | null | undefined): v is 8 | 11 | 17 | 21 {
    return v === 8 || v === 11 || v === 17 || v === 21;
  }

  const templateRunner = {
    async renderTemplate(projectId: string, targetId: string, minecraftVersion: string, packageName: string, projectName: string) {
      // Resolve output directory from DB project_path so templates land in the
      // same directory that build/package steps use.
      let dbPath: string | null = null;
      let javaVersion: 8 | 11 | 17 | 21 = 17;
      try {
        const row = storage.backend.get<{ project_path: string | null; java_version: number | null }>(
          "SELECT project_path, java_version FROM projects WHERE id = ?",
          [projectId]
        );
        if (row) {
          dbPath = row.project_path;
          if (isJavaVersion(row.java_version)) javaVersion = row.java_version;
        }
      } catch { /* fall back to defaults */ }
      const outputDir = resolveContainedProjectPath(cfg.paths.workspace, projectId, dbPath);

      const spec: ProjectSpec = {
        targetId,
        minecraftVersion,
        packageName,
        name: projectName,
        slug: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "untitled",
        type: "plugin" as const,
        buildTool: "gradle" as const,
        javaVersion,
        version: "1.0.0",
      };
      const templateId = resolveTemplateId(targetId);
      return renderTemplate(templateId, spec, outputDir, { dryRun: false, overwrite: false });
    }
  };

  const packageRunner = {
    async packageArtifacts(projectId: string, buildResult: { buildId?: string; status: string; log?: string }, projectPath: string) {
      if (!buildResult.buildId) return "No build ID available for packaging.";
      if (buildResult.status !== "success") return `Build was not successful (status: ${buildResult.status}), skipping packaging.`;

      // Verify the build record exists and belongs to this project.
      const buildRow = storage.backend.get<{ id: string; project_id: string; status: string; started_at: string; finished_at: string | null; error_summary: string | null }>(
        "SELECT id, project_id, status, started_at, finished_at, error_summary FROM builds WHERE id = ?",
        [buildResult.buildId]
      );
      if (!buildRow) return `Build record ${buildResult.buildId} not found.`;
      if (buildRow.project_id !== projectId) return `Build ${buildResult.buildId} does not belong to project ${projectId}.`;
      if (buildRow.status !== "success") return `Build ${buildResult.buildId} has status ${buildRow.status}, not packaging.`;

      const project = storage.backend.get<{ target_id: string; minecraft_version: string; java_version: number; name: string }>(
        "SELECT target_id, minecraft_version, java_version, name FROM projects WHERE id = ?",
        [projectId]
      );
      if (!project) return "Project not found.";

      const buildRecord = {
        buildId: buildRow.id,
        projectId: buildRow.project_id,
        status: "success" as const,
        startedAt: buildRow.started_at,
        finishedAt: buildRow.finished_at ?? new Date().toISOString(),
        errorSummary: buildRow.error_summary,
        logPath: join(cfg.paths.workspace, "logs", `${buildRow.id}.log`)
      };
      const records = await artifacts.createForSuccessfulBuild({
        projectId,
        projectName: project.name,
        build: buildRecord,
        workspaceRoot: cfg.paths.workspace,
        projectPath,
        targetId: project.target_id,
        minecraftVersion: project.minecraft_version,
        javaVersion: project.java_version ?? 17,
      });
      return JSON.stringify(records.map(r => ({ fileName: r.fileName, type: r.type, fileSize: r.fileSize })));
    }
  };

  const workflowRuntime = createWorkflowRuntime({
    storage,
    engine: workflowEngine,
    workflows: BUILTIN_WORKFLOWS,
    providers,
    config: {
      workspaceRoot: cfg.paths.workspace,
      logsDir: join(cfg.paths.workspace, "logs")
    },
    buildRunner,
    patchApplier,
    templateRunner,
    packageRunner
  });
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
    const decoded = Buffer.from(b64 ?? "", "base64").toString();
    const separator = decoded.indexOf(":");
    const user = separator >= 0 ? decoded.slice(0, separator) : "";
    const pass = separator >= 0 ? decoded.slice(separator + 1) : "";
    const expectedUser = cfg.auth.adminUser ?? "";
    const userOk = expectedUser.length > 0 && safeEqualString(user, expectedUser);
    if (!userOk) return reply.status(401).header("WWW-Authenticate", 'Basic realm="MC-AI-ForgeLab"').send({ error: "Unauthorized" });
    const storedHash = storage.getSetting(ADMIN_PASSWORD_HASH_KEY);
    const envPassword = process.env.MC_FORGELAB_ADMIN_PASSWORD;
    const passOk = storedHash
      ? await verifyPassword(pass, storedHash)
      : envPassword
        ? safeEqualString(pass, envPassword)
        : false;
    if (!passOk) return reply.status(401).header("WWW-Authenticate", 'Basic realm="MC-AI-ForgeLab"').send({ error: "Unauthorized" });
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
  await registerSettingsRoutes(app, ctx);
  await registerProxyRoutes(app, ctx);
  app.get("/api/health", async () => {
    const ws = getWorkspaceSettings(ctx);
    return {
      ok: true,
      version: APP_VERSION,
      storage: storage.backend.name,
      persistent: storage.backend.name === "sqlite",
      workspace: ws.workspacePath,
      limits: {
        ...cfg.limits,
        maxArtifactStorageBytes: ws.maxArtifactStorageBytes,
        artifactRetentionDays: ws.artifactRetentionDays,
      },
    };
  });

  app.addHook("onClose", async () => {
    workflowRuntime.closeAll();
    builds.closeAll();
  });

  return { app, storage, cfg };
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const cfg = loadConfig({ mode: "web" });
  const { app } = await buildApp({ cfg });
  await app.listen({ host: cfg.host, port: cfg.port });
}
