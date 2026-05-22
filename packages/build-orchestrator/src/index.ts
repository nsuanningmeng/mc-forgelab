import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveInsideBase } from "@mc-forgelab/file-operation";
import { resolveJavaWithAutoDownload, resolveGradleWrapper, bootstrapGradleWrapper, resolveMavenWrapper, bootstrapMavenWrapper } from "@mc-forgelab/toolchain-manager";

export type BuildStatus = "queued" | "running" | "success" | "failed" | "canceled";

export interface BuildRecord {
  readonly buildId: string;
  readonly projectId: string;
  readonly status: BuildStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly logPath: string;
  readonly errorSummary: string | null;
}

export interface BuildOptions {
  readonly buildId?: string;
  readonly workspaceRoot: string;
  readonly projectPath: string;
  readonly javaVersion?: 8 | 11 | 17 | 21;
  readonly timeoutMs?: number;
  readonly logsDir?: string;
  readonly buildTool?: "gradle" | "maven";
  /** Optional AbortSignal — aborting kills the spawned build process. */
  readonly signal?: AbortSignal;
}

async function resolveGradleBuildTool(projectPath: string, onLog: (line: string) => void) {
  try {
    return await resolveGradleWrapper(projectPath);
  } catch {
    onLog("[toolchain] Gradle wrapper not found, bootstrapping...");
    return bootstrapGradleWrapper(projectPath, undefined, { onProgress: (msg) => onLog(`[toolchain] ${msg}`) });
  }
}

async function resolveMavenBuildTool(projectPath: string, onLog: (line: string) => void) {
  try {
    return await resolveMavenWrapper(projectPath);
  } catch {
    onLog("[toolchain] Maven wrapper not found, bootstrapping...");
    return bootstrapMavenWrapper(projectPath, undefined, { onProgress: (msg) => onLog(`[toolchain] ${msg}`) });
  }
}

/** Execute a build in the project directory. Supports Gradle and Maven via buildTool option. */
export async function runBuild(
  projectId: string,
  opts: BuildOptions,
  onLog: (line: string) => void = () => {}
): Promise<BuildRecord> {
  const buildId = opts.buildId ?? randomUUID();
  const startedAt = new Date().toISOString();
  const logsDir = opts.logsDir ?? join(opts.workspaceRoot, "logs");
  const logPath = join(logsDir, `${buildId}.log`);
  mkdirSync(logsDir, { recursive: true });

  // Validate project path is inside workspace
  const rel = relative(opts.workspaceRoot, opts.projectPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("projectPath is outside workspaceRoot");

  const javaVersion = opts.javaVersion ?? 17;
  const java = await resolveJavaWithAutoDownload(javaVersion, { onProgress: (msg) => onLog(`[toolchain] ${msg}`) });

  const buildTool = opts.buildTool ?? "gradle";
  const tool = buildTool === "maven"
    ? await resolveMavenBuildTool(opts.projectPath, onLog)
    : await resolveGradleBuildTool(opts.projectPath, onLog);
  const buildArgs = buildTool === "maven"
    ? ["package", "-B", "-e"]
    : ["build", "--no-daemon", "--stacktrace"];

  // Whitelist env — never inherit full process.env to avoid leaking host secrets
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const ALLOWED_ENV_KEYS = new Set(["SYSTEMROOT", "TEMP", "TMP", "HOME", "USER", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH", pathKey]);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && ALLOWED_ENV_KEYS.has(k)) env[k] = v;
  }
  Object.assign(env, java.env);

  const logStream = createWriteStream(logPath, { flags: "a" });
  const lines: string[] = [];

  return new Promise((resolve) => {
    const timeout = opts.timeoutMs ?? 300_000;
    const proc = spawn(tool.executable, [...(tool.args ?? []), ...buildArgs], {
      cwd: opts.projectPath,
      env,
      shell: false
    });

    let canceled = false;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let onAbort: (() => void) | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (onAbort && opts.signal) opts.signal.removeEventListener("abort", onAbort);
      proc.stdout.off("data", handleLine);
      proc.stderr.off("data", handleLine);
    };

    const finish = (status: BuildStatus, errorSummary: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      const finishedAt = new Date().toISOString();
      const record = { buildId, projectId, status, startedAt, finishedAt, logPath, errorSummary };
      if (logStream.destroyed || !logStream.writable) {
        resolve(record);
        return;
      }
      logStream.end(() => resolve(record));
    };

    const killProc = () => {
      try {
        proc.kill(process.platform === "win32" ? "SIGKILL" : "SIGTERM");
      } catch { /* already dead */ }
    };

    timer = setTimeout(killProc, timeout);

    if (opts.signal) {
      if (opts.signal.aborted) {
        canceled = true;
        killProc();
      } else {
        onAbort = () => { canceled = true; killProc(); };
        opts.signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    const handleLine = (data: Buffer) => {
      const text = data.toString();
      if (!logStream.destroyed) logStream.write(text);
      text.split("\n").filter(Boolean).forEach((l) => { lines.push(l); onLog(l); });
    };

    proc.stdout.on("data", handleLine);
    proc.stderr.on("data", handleLine);

    proc.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      handleLine(Buffer.from(`[build] failed to start ${buildTool}: ${message}\n`));
      finish("failed", message);
    });

    proc.on("close", (code) => {
      const status: BuildStatus = canceled ? "canceled" : (code === 0 ? "success" : "failed");
      const errorSummary = (!canceled && code !== 0) ? extractErrorSummary(lines) : null;
      finish(status, errorSummary);
    });
  });
}

export async function runMavenBuild(
  projectId: string,
  opts: Omit<BuildOptions, "buildTool">,
  onLog: (line: string) => void = () => {}
): Promise<BuildRecord> {
  return runBuild(projectId, { ...opts, buildTool: "maven" }, onLog);
}

/** Extract the most relevant error lines from build output (max 20 lines). */
export function extractErrorSummary(lines: string[]): string {
  const errorLines = lines.filter((l) =>
    /error:|FAILED|Exception|Could not|BUILD FAILED/i.test(l)
  );
  return errorLines.slice(0, 20).join("\n") || lines.slice(-10).join("\n");
}
