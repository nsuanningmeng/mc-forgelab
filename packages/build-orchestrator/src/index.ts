import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, dirname, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveInsideBase } from "@mc-forgelab/file-operation";
import { resolveJavaWithAutoDownload, resolveGradleWrapper, bootstrapGradleWrapper } from "@mc-forgelab/toolchain-manager";

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
  /** Optional AbortSignal — aborting kills the spawned Gradle process. */
  readonly signal?: AbortSignal;
}

/** Execute a Gradle build in the project directory. Returns a BuildRecord. */
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

  // Validate project path is inside workspace (use relative() to avoid prefix-collision)
  const rel = relative(opts.workspaceRoot, opts.projectPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("projectPath is outside workspaceRoot");

  const javaVersion = opts.javaVersion ?? 17;
  const java = await resolveJavaWithAutoDownload(javaVersion, { onProgress: (msg) => onLog(`[toolchain] ${msg}`) });

  let gradle;
  try {
    gradle = await resolveGradleWrapper(opts.projectPath);
  } catch {
    onLog("[toolchain] Gradle wrapper not found, bootstrapping...");
    gradle = await bootstrapGradleWrapper(opts.projectPath, undefined, { onProgress: (msg) => onLog(`[toolchain] ${msg}`) });
  }

  // Whitelist env — never inherit full process.env to avoid leaking host secrets
  // PATH is required for gradle/java resolution; include platform-correct key
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
    const proc = spawn(gradle.executable, [...(gradle.args ?? []), "build", "--no-daemon", "--stacktrace"], {
      cwd: opts.projectPath,
      env,
      shell: false
    });

    let canceled = false;
    const killProc = () => {
      try {
        proc.kill(process.platform === "win32" ? "SIGKILL" : "SIGTERM");
      } catch { /* already dead */ }
    };

    const timer = setTimeout(killProc, timeout);

    // External cancel via AbortSignal
    let onAbort: (() => void) | null = null;
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
      logStream.write(text);
      text.split("\n").filter(Boolean).forEach((l) => { lines.push(l); onLog(l); });
    };

    proc.stdout.on("data", handleLine);
    proc.stderr.on("data", handleLine);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (onAbort && opts.signal) opts.signal.removeEventListener("abort", onAbort);
      logStream.end();
      const finishedAt = new Date().toISOString();
      const status: BuildStatus = canceled ? "canceled" : (code === 0 ? "success" : "failed");
      const errorSummary = (!canceled && code !== 0) ? extractErrorSummary(lines) : null;
      resolve({ buildId, projectId, status, startedAt, finishedAt, logPath, errorSummary });
    });
  });
}

/** Extract the most relevant error lines from build output (max 20 lines). */
export function extractErrorSummary(lines: string[]): string {
  const errorLines = lines.filter((l) =>
    /error:|FAILED|Exception|Could not|BUILD FAILED/i.test(l)
  );
  return errorLines.slice(0, 20).join("\n") || lines.slice(-10).join("\n");
}
