import { existsSync } from "node:fs";
import { join } from "node:path";
import { platform as osPlatform, arch as osArch, homedir } from "node:os";
import { execFileSync } from "node:child_process";

export type ToolName = "java" | "gradle" | "maven";
export type Platform = "win32" | "darwin" | "linux";
export type Arch = "x64" | "arm64";

export interface ResolvedTool {
  readonly executable: string;
  readonly env: Readonly<Record<string, string>>;
}

export interface ToolchainStatus {
  readonly toolName: ToolName;
  readonly installed: boolean;
  readonly version: string | null;
  readonly issues: ReadonlyArray<string>;
}

function toolchainsDir(): string {
  const p = osPlatform();
  const h = homedir();
  if (p === "win32") return join(process.env.LOCALAPPDATA ?? join(h, "AppData", "Local"), "MC-ForgeLab", "toolchains");
  if (p === "darwin") return join(h, "Library", "Application Support", "MC-ForgeLab", "toolchains");
  return join(h, ".local", "share", "mc-forgelab", "toolchains");
}

function tryExec(cmd: string, args: string[]): string | null {
  try { return execFileSync(cmd, args, { encoding: "utf8", timeout: 5000 }).trim(); }
  catch { return null; }
}

/** Resolve Java executable — prefers managed toolchain, falls back to system java */
export async function resolveJava(version: 8 | 11 | 17 | 21): Promise<ResolvedTool> {
  const managed = join(toolchainsDir(), `jdk-${version}`, osPlatform() === "win32" ? "bin/java.exe" : "bin/java");
  if (existsSync(managed)) {
    const javaHome = join(toolchainsDir(), `jdk-${version}`);
    return { executable: managed, env: { JAVA_HOME: javaHome } };
  }
  // Fall back to system java
  const sysJava = osPlatform() === "win32" ? "java.exe" : "java";
  const ver = tryExec(sysJava, ["-version"]);
  if (ver) return { executable: sysJava, env: {} };
  throw new Error(`Java ${version} not found. Install via: mcforgelab toolchain install java --version ${version}`);
}

/** Resolve Gradle wrapper in project dir, or fall back to system gradle */
export async function resolveGradleWrapper(projectDir: string): Promise<ResolvedTool> {
  const wrapper = osPlatform() === "win32" ? join(projectDir, "gradlew.bat") : join(projectDir, "gradlew");
  if (existsSync(wrapper)) return { executable: wrapper, env: {} };
  const sysGradle = osPlatform() === "win32" ? "gradle.bat" : "gradle";
  const ver = tryExec(sysGradle, ["--version"]);
  if (ver) return { executable: sysGradle, env: {} };
  throw new Error("Gradle wrapper not found and no system gradle available.");
}

export async function doctor(): Promise<ReadonlyArray<ToolchainStatus>> {
  const results: ToolchainStatus[] = [];
  for (const v of [8, 11, 17, 21] as const) {
    try {
      const t = await resolveJava(v);
      const ver = tryExec(t.executable, ["-version"]);
      results.push({ toolName: "java", installed: true, version: ver?.split("\n")[0] ?? null, issues: [] });
    } catch (e) {
      results.push({ toolName: "java", installed: false, version: null, issues: [(e as Error).message] });
    }
  }
  return results;
}
