import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { runBuild, type BuildStatus } from "@mc-forgelab/build-orchestrator";
import type { Storage } from "@mc-forgelab/storage";

export type BuildEntryStatus = BuildStatus | "interrupted";
export type BuildEventType = "log" | "status" | "done";

export interface BuildEvent {
  readonly type: BuildEventType;
  readonly line?: string;
  readonly status?: BuildEntryStatus;
  readonly errorSummary?: string | null;
  readonly finishedAt?: string | null;
}

export interface BuildEntry {
  readonly buildId: string;
  readonly projectId: string;
  status: BuildEntryStatus;
  readonly startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
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
  "interrupted"
]);

export interface BuildRegistry {
  start(opts: StartBuildOptions): BuildEntry;
  list(projectId: string): readonly BuildEntry[];
  get(buildId: string): BuildEntry | undefined;
  hasActive(projectId: string): boolean;
  subscribe(buildId: string, onEvent: (e: BuildEvent) => void): () => void;
  cancel(buildId: string): boolean;
  closeAll(): void;
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

  function normalizeStatus(status: string): BuildEntryStatus {
    return BUILD_STATUSES.has(status as BuildEntryStatus) ? (status as BuildEntryStatus) : "failed";
  }

  function nextSequence(buildId: string): number {
    const current = sequences.get(buildId) ?? 0;
    sequences.set(buildId, current + 1);
    return current;
  }

  function persistEvent(
    buildId: string,
    type: "log" | "status",
    line: string | null,
    payload: Record<string, unknown> | null
  ): void {
    storage.backend.run(
      "INSERT INTO build_events (id, build_id, type, line, payload_json, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        randomUUID(),
        buildId,
        type,
        line,
        payload ? JSON.stringify(payload) : null,
        new Date().toISOString(),
        nextSequence(buildId)
      ]
    );
  }

  function tryPersist(fn: () => void): void {
    try {
      fn();
    } catch {
      // Keep the running build and SSE listeners alive even if persistence fails.
    }
  }

  function broadcast(entry: BuildEntry, event: BuildEvent): void {
    for (const fn of entry.listeners) {
      try { fn(event); } catch { /* ignore listener errors */ }
    }
  }

  function appendLine(entry: BuildEntry, line: string): void {
    entry.lines.push(line);
    if (entry.lines.length > MAX_LINES) entry.lines.shift();
    tryPersist(() => persistEvent(entry.buildId, "log", line, null));
    broadcast(entry, { type: "log", line });
  }

  function finishBuild(
    entry: BuildEntry,
    status: BuildEntryStatus,
    finishedAt: string,
    errorSummary: string | null,
    logPath: string | null
  ): void {
    entry.status = status;
    entry.finishedAt = finishedAt;
    entry.errorSummary = errorSummary;
    entry.logPath = logPath;
    entry.abort = null;

    tryPersist(() => {
      storage.backend.run(
        "UPDATE builds SET status = ?, finished_at = ?, log_path = ?, error_summary = ? WHERE id = ?",
        [status, finishedAt, logPath, errorSummary, entry.buildId]
      );
      persistEvent(entry.buildId, "status", null, {
        status,
        errorSummary,
        finishedAt,
        logPath
      });
    });

    broadcast(entry, {
      type: "status",
      status,
      errorSummary,
      finishedAt,
    });
    broadcast(entry, { type: "done" });
  }

  function loadLogLines(buildId: string): string[] {
    const rows = storage.backend.all<BuildEventRow>(
      "SELECT build_id, type, line, sequence FROM build_events WHERE build_id = ? AND type = 'log' ORDER BY sequence",
      [buildId]
    );
    return rows
      .filter((row) => row.build_id === buildId && row.type === "log" && typeof row.line === "string")
      .sort((a, b) => a.sequence - b.sequence)
      .map((row) => row.line as string)
      .slice(-MAX_LINES);
  }

  function rowToEntry(row: BuildRow, hydrateLines: boolean): BuildEntry {
    return {
      buildId: row.id,
      projectId: row.project_id,
      status: normalizeStatus(row.status),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      errorSummary: row.error_summary,
      lines: hydrateLines ? loadLogLines(row.id) : [],
      listeners: new Set<(e: BuildEvent) => void>(),
      logPath: row.log_path,
      abort: null,
    };
  }

  function loadBuildRows(projectId: string): BuildRow[] {
    const rows = storage.backend.all<BuildRow>(
      "SELECT id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary FROM builds WHERE project_id = ? ORDER BY started_at DESC",
      [projectId]
    );
    return rows
      .filter((row) => row.project_id === projectId)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  }

  return {
    start(opts) {
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

      storage.backend.run(
        `INSERT INTO builds (id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          buildId,
          opts.projectId,
          "running",
          startedAt,
          null,
          project.target_id,
          project.minecraft_version,
          javaVersion,
          project.build_tool,
          logPath,
          null
        ]
      );

      const abort = new AbortController();
      const entry: BuildEntry = {
        buildId,
        projectId: opts.projectId,
        status: "running",
        startedAt,
        finishedAt: null,
        errorSummary: null,
        lines: [],
        listeners: new Set<(e: BuildEvent) => void>(),
        logPath,
        abort,
      };
      entries.set(buildId, entry);
      sequences.set(buildId, 0);

      runBuild(opts.projectId, {
        workspaceRoot: opts.workspaceRoot,
        projectPath: opts.projectPath,
        javaVersion,
        timeoutMs: opts.timeoutMs,
        logsDir,
        signal: abort.signal,
      }, (line) => appendLine(entry, line))
        .then((rec) => {
          finishBuild(
            entry,
            rec.status,
            rec.finishedAt ?? new Date().toISOString(),
            rec.errorSummary,
            rec.logPath ?? entry.logPath
          );
        })
        .catch((err: unknown) => {
          finishBuild(
            entry,
            "failed",
            new Date().toISOString(),
            err instanceof Error ? err.message : String(err),
            entry.logPath
          );
        });

      return entry;
    },

    list(projectId) {
      const live = [...entries.values()]
        .filter((entry) => entry.projectId === projectId && entry.status === "running")
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

      const liveIds = new Set(live.map((entry) => entry.buildId));
      // For list responses we never need the full log buffer per row —
      // hydrating up to 5000 lines per build would be O(N*lines).
      // Callers that need the lines use `get()` which always hydrates.
      const persisted = loadBuildRows(projectId)
        .filter((row) => !liveIds.has(row.id))
        .map((row) => rowToEntry(row, false));

      return [...live, ...persisted];
    },

    get(buildId) {
      const entry = entries.get(buildId);
      if (entry) return entry;

      const row = storage.backend.get<BuildRow>(
        "SELECT id, project_id, status, started_at, finished_at, target_id, minecraft_version, java_version, build_tool, log_path, error_summary FROM builds WHERE id = ?",
        [buildId]
      );
      return row ? rowToEntry(row, true) : undefined;
    },

    hasActive(projectId) {
      for (const entry of entries.values()) {
        if (entry.projectId === projectId && entry.status === "running") return true;
      }
      return false;
    },

    subscribe(buildId, onEvent) {
      const entry = entries.get(buildId);
      if (!entry) return () => { /* noop */ };
      entry.listeners.add(onEvent);
      return () => entry.listeners.delete(onEvent);
    },

    cancel(buildId) {
      const entry = entries.get(buildId);
      if (!entry || !entry.abort || entry.status !== "running") return false;
      try { entry.abort.abort(); } catch { /* already aborted */ }
      return true;
    },

    closeAll() {
      for (const entry of entries.values()) {
        if (entry.abort && entry.status === "running") {
          try { entry.abort.abort(); } catch { /* ignore */ }
        }
      }
    },
  };
}
