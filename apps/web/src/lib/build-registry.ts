import { createHash, randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { sha256File } from "@mc-forgelab/artifact-manager";
import { runBuild, type BuildStatus } from "@mc-forgelab/build-orchestrator";
import type { Storage } from "@mc-forgelab/storage";

export type BuildEntryStatus = BuildStatus | "interrupted" | "cached";
export type BuildEventType = "log" | "status" | "done";

export interface BuildEvent {
  readonly type: BuildEventType;
  readonly line?: string;
  readonly status?: BuildEntryStatus;
  readonly errorSummary?: string | null;
  readonly finishedAt?: string | null;
  readonly sourceHash?: string | null;
  readonly cachedFromBuildId?: string | null;
}

export interface BuildEntry {
  readonly buildId: string;
  readonly projectId: string;
  status: BuildEntryStatus;
  readonly startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  readonly sourceHash: string | null;
  readonly cachedFromBuildId: string | null;
  readonly lines: string[];
  readonly listeners: Set<(e: BuildEvent) => void>;
  logPath: string | null;
  abort: AbortController | null;
}

export interface StartBuildOptions {
  readonly projectId: string;
  readonly workspaceRoot: string;
  readonly projectPath: string;
  readonly javaVersion?: 8 | 11 | 17 | 21;
  readonly timeoutMs?: number;
  readonly logsDir?: string;
  readonly force?: boolean;
}

const MAX_LINES = 5000;

interface ProjectBuildRow {
  readonly id: string;
  readonly target_id: string;
  readonly minecraft_version: string;
  readonly java_version: number;
  readonly build_tool: string;
}

interface BuildRow {
  readonly id: string;
  readonly project_id: string;
  readonly status: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly target_id: string;
  readonly minecraft_version: string;
  readonly java_version: number;
  readonly build_tool: string;
  readonly log_path: string | null;
  readonly error_summary: string | null;
  readonly source_hash: string | null;
}

interface BuildEventRow {
  readonly build_id: string;
  readonly type: string;
  readonly line: string | null;
  readonly sequence: number;
}

const BUILD_STATUSES = new Set<BuildEntryStatus>([
  "queued",
  "running",
  "success",
  "failed",
  "canceled",
  "interrupted",
  "cached"
]);

const SOURCE_HASH_IGNORED_DIRS = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".vscode",
  "build",
  "dist",
  "node_modules",
  "out"
]);

export interface BuildRegistry {
  start(opts: StartBuildOptions): Promise<BuildEntry>;
  list(projectId: string): readonly BuildEntry[];
  get(buildId: string): BuildEntry | undefined;
  hasActive(projectId: string): boolean;
  subscribe(buildId: string, onEvent: (e: BuildEvent) => void): () => void;
  cancel(buildId: string): boolean;
  closeAll(): void;
}

function normalizeHashPath(path: string): string {
  return path.split(sep).join("/");
}

async function listSourceFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SOURCE_HASH_IGNORED_DIRS.has(entry.name)) await walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        files.push(join(dir, entry.name));
      }
    }
  }

  await walk(projectPath);
  return files;
}

async function hashProjectSource(projectPath: string): Promise<string | null> {
  try {
    const files = await listSourceFiles(projectPath);
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(normalizeHashPath(relative(projectPath, file)));
      hash.update("\0");
      hash.update(await sha256File(file));
      hash.update("\0");
    }
    return hash.digest("hex");
  } catch {
    return null;
  }
}

export function createBuildRegistry(storage: Storage): BuildRegistry {
  const entries = new Map<string, BuildEntry>();
  const sequences = new Map<string, number>();

  markInterruptedBuilds();

  function markInterruptedBuilds(): void {
    storage.backend.run(
      "UPDATE builds SET status = 'interrupted', finished_at = COALESCE(finished_at, ?) WHERE status IN ('running', 'queued')",
      [new Date().toISOString()]
    );
  }

  function tryPersist(fn: () => void): void {
    try { fn(); } catch { /* ignore */ }
  }

  function persistEvent(buildId: string, type: string, line: string | null, extra: Record<string, unknown> = {}): void {
    const seq = (sequences.get(buildId) ?? 0) + 1;
    sequences.set(buildId, seq);
    storage.backend.run(
      "INSERT INTO build_events (id, build_id, type, line, payload_json, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), buildId, type, line, JSON.stringify({ type, line, ...extra }), new Date().toISOString(), seq]
    );
  }

  function loadLogLines(buildId: string): string[] {
    return storage.backend.all<BuildEventRow>(
      "SELECT line FROM build_events WHERE build_id = ? AND type = 'log' ORDER BY sequence",
      [buildId]
    ).map((r) => r.line ?? "").filter((l) => l.length > 0);
  }

  function rowToEntry(row: BuildRow, hydrateLines = false): BuildEntry {
    return {
      buildId: row.id,
      projectId: row.project_id,
      status: BUILD_STATUSES.has(row.status as BuildEntryStatus) ? row.status as BuildEntryStatus : "failed",
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      errorSummary: row.error_summary,
      sourceHash: row.source_hash,
      cachedFromBuildId: null,
      lines: hydrateLines ? loadLogLines(row.id) : [],
      listeners: new Set<(e: BuildEvent) => void>(),
      logPath: row.log_path,
      abort: null,
    };
  }

  function loadBuildRows(projectId: string): BuildRow[] {
    const rows = storage.backend.all<BuildRow>(
      "SELECT id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary, source_hash FROM builds WHERE project_id = ? ORDER BY started_at DESC",
      [projectId]
    );
    return rows
      .filter((row) => row.project_id === projectId)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  }

  function findCacheHit(project: ProjectBuildRow, javaVersion: number, sourceHash: string): BuildRow | undefined {
    const rows = storage.backend.all<BuildRow>(
      `SELECT id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary, source_hash
       FROM builds
       WHERE project_id = ?
         AND target_id = ?
         AND minecraft_version = ?
         AND java_version = ?
         AND build_tool = ?
         AND source_hash = ?
         AND status = 'success'
       ORDER BY started_at DESC`,
      [project.id, project.target_id, project.minecraft_version, javaVersion, project.build_tool, sourceHash]
    );
    return rows[0];
  }

  return {
    async start(opts) {
      const project = storage.backend.get<ProjectBuildRow>(
        "SELECT id, target_id, minecraft_version, java_version, build_tool FROM projects WHERE id = ?",
        [opts.projectId]
      );
      if (!project) throw new Error("Project not found");

      const buildId = randomUUID();
      const startedAt = new Date().toISOString();
      const logsDir = opts.logsDir ?? join(opts.workspaceRoot, "logs");
      const logPath = join(logsDir, `${buildId}.log`);
      const javaVersion = opts.javaVersion ?? (project.java_version as 8 | 11 | 17 | 21);
      const sourceHash = await hashProjectSource(opts.projectPath);
      const cachedFrom = !opts.force && sourceHash ? findCacheHit(project, javaVersion, sourceHash) : undefined;

      if (cachedFrom) {
        storage.backend.run(
          `INSERT INTO builds (id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary, source_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [buildId, opts.projectId, "cached", startedAt, startedAt, project.target_id, project.minecraft_version, javaVersion, project.build_tool, null, null, sourceHash]
        );

        const entry: BuildEntry = {
          buildId,
          projectId: opts.projectId,
          status: "cached",
          startedAt,
          finishedAt: startedAt,
          errorSummary: null,
          sourceHash,
          cachedFromBuildId: cachedFrom.id,
          lines: [],
          listeners: new Set<(e: BuildEvent) => void>(),
          logPath: null,
          abort: null,
        };
        entries.set(buildId, entry);
        sequences.set(buildId, 0);
        tryPersist(() => persistEvent(buildId, "status", null, { status: "cached", finishedAt: startedAt, sourceHash, cachedFromBuildId: cachedFrom.id }));
        return entry;
      }

      storage.backend.run(
        `INSERT INTO builds (id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary, source_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [buildId, opts.projectId, "running", startedAt, null, project.target_id, project.minecraft_version, javaVersion, project.build_tool, logPath, null, sourceHash]
      );

      const controller = new AbortController();
      const entry: BuildEntry = {
        buildId,
        projectId: opts.projectId,
        status: "running",
        startedAt,
        finishedAt: null,
        errorSummary: null,
        sourceHash,
        cachedFromBuildId: null,
        lines: [],
        listeners: new Set<(e: BuildEvent) => void>(),
        logPath,
        abort: controller,
      };
      entries.set(buildId, entry);
      sequences.set(buildId, 0);
      tryPersist(() => persistEvent(buildId, "status", null, { status: "running" }));

      runBuild(opts.projectId, {
        workspaceRoot: opts.workspaceRoot,
        projectPath: opts.projectPath,
        javaVersion,
        timeoutMs: opts.timeoutMs,
        logsDir,
        signal: controller.signal,
      }, (line) => {
        entry.lines.push(line);
        if (entry.lines.length > MAX_LINES) entry.lines.shift();
        tryPersist(() => persistEvent(buildId, "log", line));
        for (const listener of entry.listeners) {
          try { listener({ type: "log", line }); } catch { /* ignore */ }
        }
      }).then((result) => {
        entry.status = result.status === "success" ? "success" : result.status === "canceled" ? "canceled" : "failed";
        entry.finishedAt = new Date().toISOString();
        entry.errorSummary = result.errorSummary ?? null;
        storage.backend.run(
          "UPDATE builds SET status = ?, finished_at = ?, error_summary = ? WHERE id = ?",
          [entry.status, entry.finishedAt, entry.errorSummary, buildId]
        );
        tryPersist(() => persistEvent(buildId, "status", null, { status: entry.status, finishedAt: entry.finishedAt, errorSummary: entry.errorSummary }));
        for (const listener of entry.listeners) {
          try { listener({ type: "status", status: entry.status, errorSummary: entry.errorSummary, finishedAt: entry.finishedAt }); } catch { /* ignore */ }
        }
      }).catch((err) => {
        entry.status = "failed";
        entry.finishedAt = new Date().toISOString();
        entry.errorSummary = err instanceof Error ? err.message : String(err);
        storage.backend.run(
          "UPDATE builds SET status = ?, finished_at = ?, error_summary = ? WHERE id = ?",
          [entry.status, entry.finishedAt, entry.errorSummary, buildId]
        );
        tryPersist(() => persistEvent(buildId, "status", null, { status: entry.status, finishedAt: entry.finishedAt, errorSummary: entry.errorSummary }));
        for (const listener of entry.listeners) {
          try { listener({ type: "status", status: entry.status, errorSummary: entry.errorSummary, finishedAt: entry.finishedAt }); } catch { /* ignore */ }
        }
      });

      return entry;
    },

    list(projectId) {
      return loadBuildRows(projectId).map((row) => rowToEntry(row));
    },

    get(buildId) {
      const entry = entries.get(buildId);
      if (entry) return entry;

      const row = storage.backend.get<BuildRow>(
        "SELECT id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary, source_hash FROM builds WHERE id = ?",
        [buildId]
      );
      return row ? rowToEntry(row, true) : undefined;
    },

    hasActive(projectId) {
      const active = entries.get(
        storage.backend.get<{ id: string }>(
          "SELECT id FROM builds WHERE project_id = ? AND status IN ('running', 'queued') LIMIT 1",
          [projectId]
        )?.id ?? ""
      );
      return !!active && (active.status === "running" || active.status === "queued");
    },

    subscribe(buildId, onEvent) {
      const entry = entries.get(buildId);
      if (!entry) return () => {};
      entry.listeners.add(onEvent);
      return () => { entry.listeners.delete(onEvent); };
    },

    cancel(buildId) {
      const entry = entries.get(buildId);
      if (!entry || entry.status !== "running") return false;
      entry.abort?.abort();
      return true;
    },

    closeAll() {
      for (const [, entry] of entries) {
        if (entry.status === "running") {
          entry.abort?.abort();
        }
      }
    },
  };
}
