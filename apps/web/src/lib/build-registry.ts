// In-memory build registry: tracks running/finished Gradle builds per process.
// SSE listeners subscribe by buildId and receive log/status events.
//
// Lifecycle:
//  - start(opts) creates an entry, spawns the build via runBuild() with an
//    AbortController, and emits log/status/done events to listeners.
//  - cancel(buildId) aborts a running build (kills the child process).
//  - closeAll() aborts all running builds — meant to be called from
//    Fastify onClose so server shutdown does not orphan Gradle processes.
//
// NOTE: Build records are NOT persisted across server restarts.
import { randomUUID } from "node:crypto";
import { runBuild, type BuildStatus } from "@mc-forgelab/build-orchestrator";

export type BuildEventType = "log" | "status" | "done";

export interface BuildEvent {
  readonly type: BuildEventType;
  readonly line?: string;
  readonly status?: BuildStatus;
  readonly errorSummary?: string | null;
  readonly finishedAt?: string | null;
}

export interface BuildEntry {
  readonly buildId: string;
  readonly projectId: string;
  status: BuildStatus;
  readonly startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  readonly lines: string[];          // capped at MAX_LINES
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

const MAX_LINES = 5000; // ring buffer cap

export interface BuildRegistry {
  start(opts: StartBuildOptions): BuildEntry;
  list(projectId: string): readonly BuildEntry[];
  get(buildId: string): BuildEntry | undefined;
  hasActive(projectId: string): boolean;
  subscribe(buildId: string, onEvent: (e: BuildEvent) => void): () => void;
  cancel(buildId: string): boolean;
  closeAll(): void;
}

export function createBuildRegistry(): BuildRegistry {
  const entries = new Map<string, BuildEntry>();

  function broadcast(entry: BuildEntry, event: BuildEvent): void {
    for (const fn of entry.listeners) {
      try { fn(event); } catch { /* ignore listener errors */ }
    }
  }

  function appendLine(entry: BuildEntry, line: string): void {
    entry.lines.push(line);
    if (entry.lines.length > MAX_LINES) entry.lines.shift();
    broadcast(entry, { type: "log", line });
  }

  return {
    start(opts) {
      const buildId = randomUUID();
      const abort = new AbortController();
      const entry: BuildEntry = {
        buildId,
        projectId: opts.projectId,
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        errorSummary: null,
        lines: [],
        listeners: new Set(),
        logPath: null,
        abort,
      };
      entries.set(buildId, entry);

      // Kick off async; do NOT await here.
      runBuild(opts.projectId, {
        workspaceRoot: opts.workspaceRoot,
        projectPath: opts.projectPath,
        javaVersion: opts.javaVersion,
        timeoutMs: opts.timeoutMs,
        logsDir: opts.logsDir,
        signal: abort.signal,
      }, (line) => appendLine(entry, line))
        .then((rec) => {
          entry.status = rec.status;
          entry.finishedAt = rec.finishedAt;
          entry.errorSummary = rec.errorSummary;
          entry.logPath = rec.logPath;
          entry.abort = null;
          broadcast(entry, {
            type: "status",
            status: rec.status,
            errorSummary: rec.errorSummary,
            finishedAt: rec.finishedAt,
          });
          broadcast(entry, { type: "done" });
        })
        .catch((err: Error) => {
          entry.status = "failed";
          entry.finishedAt = new Date().toISOString();
          entry.errorSummary = err?.message ?? String(err);
          entry.abort = null;
          broadcast(entry, {
            type: "status",
            status: "failed",
            errorSummary: entry.errorSummary,
            finishedAt: entry.finishedAt,
          });
          broadcast(entry, { type: "done" });
        });

      return entry;
    },

    list(projectId) {
      const out: BuildEntry[] = [];
      for (const e of entries.values()) {
        if (e.projectId === projectId) out.push(e);
      }
      // newest first
      return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    },

    get(buildId) {
      return entries.get(buildId);
    },

    hasActive(projectId) {
      for (const e of entries.values()) {
        if (e.projectId === projectId && e.status === "running") return true;
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
