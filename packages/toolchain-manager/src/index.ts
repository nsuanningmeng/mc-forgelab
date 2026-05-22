import { existsSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { platform as osPlatform, arch as osArch, homedir } from "node:os";
import { execFileSync, execSync } from "node:child_process";
import { get as httpsGet } from "node:https";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

export type ToolName = "java" | "gradle" | "maven";
export type Platform = "win32" | "darwin" | "linux";
export type Arch = "x64" | "arm64";

export interface ResolvedTool {
  readonly executable: string;
  readonly env: Readonly<Record<string, string>>;
  readonly args?: ReadonlyArray<string>;
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
  // java -version writes to stderr; capture both streams
  try { return execFileSync(cmd, args, { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (e) { return (e as NodeJS.ErrnoException & { stderr?: string }).stderr?.trim() ?? null; }
}

/** Resolve Java executable — prefers managed toolchain, falls back to system java */
export async function resolveJava(version: 8 | 11 | 17 | 21): Promise<ResolvedTool> {
  const managed = join(toolchainsDir(), `jdk-${version}`, "bin", osPlatform() === "win32" ? "java.exe" : "java");
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
  // gradlew.bat on Windows requires cmd.exe; shell:false cannot execute .bat directly
  if (existsSync(wrapper)) {
    if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapper] };
    return { executable: wrapper, env: {} };
  }
  const sysGradle = osPlatform() === "win32" ? "gradle.bat" : "gradle";
  const ver = tryExec(sysGradle, ["--version"]);
  if (ver) return { executable: sysGradle, env: {} };
  throw new Error("Gradle wrapper not found and no system gradle available.");
}

interface AdoptiumBinary {
  package: { link: string; name: string; size: number };
}

async function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    httpsGet(url, { headers: { Accept: "application/json" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson<T>(res.headers.location!).then(resolve, reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      httpsGet(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        pipeline(res, createWriteStream(dest)).then(resolve, reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

function getAdoptiumOs(): string {
  const p = osPlatform();
  if (p === "win32") return "windows";
  if (p === "darwin") return "mac";
  return "linux";
}

function getAdoptiumArch(): string {
  return osArch() === "arm64" ? "aarch64" : "x64";
}

export interface DownloadJdkOptions {
  readonly onProgress?: (message: string) => void;
}

/**
 * Download JDK from Eclipse Adoptium and install to managed toolchain directory.
 * Skips if already installed.
 */
export async function downloadJdk(version: 8 | 11 | 17 | 21, opts: DownloadJdkOptions = {}): Promise<ResolvedTool> {
  const log = opts.onProgress ?? (() => {});

  // Check if already installed
  const managed = join(toolchainsDir(), `jdk-${version}`, "bin", osPlatform() === "win32" ? "java.exe" : "java");
  if (existsSync(managed)) {
    const javaHome = join(toolchainsDir(), `jdk-${version}`);
    return { executable: managed, env: { JAVA_HOME: javaHome } };
  }

  const os = getAdoptiumOs();
  const arch = getAdoptiumArch();
  const api = `https://api.adoptium.net/v3/assets/latest/${version}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`;

  log(`Fetching Adoptium JDK ${version} metadata...`);
  const assets = await fetchJson<AdoptiumBinary[]>(api);
  if (!assets.length || !assets[0]?.package?.link) {
    throw new Error(`No Adoptium JDK ${version} found for ${os}/${arch}`);
  }

  const pkg = assets[0].package;
  const ext = os === "windows" ? "zip" : "tar.gz";
  const archivePath = join(toolchainsDir(), `jdk-${version}-download.${ext}`);

  mkdirSync(toolchainsDir(), { recursive: true });
  log(`Downloading JDK ${version} (${(pkg.size / 1024 / 1024).toFixed(0)} MB)...`);
  await downloadFile(pkg.link, archivePath);

  log("Extracting...");
  const extractDir = join(toolchainsDir(), `jdk-${version}-tmp`);
  mkdirSync(extractDir, { recursive: true });

  if (os === "windows") {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`, { timeout: 120_000 });
  } else {
    execSync(`tar xzf "${archivePath}" -C "${extractDir}"`, { timeout: 120_000 });
  }

  // Adoptium archives contain a single top-level directory (e.g., jdk-21.0.11+10)
  const { readdirSync } = await import("node:fs");
  const entries = readdirSync(extractDir);
  const jdkDir = entries.find((e) => e.startsWith("jdk-")) ?? entries[0];
  if (!jdkDir) throw new Error("Extraction failed: no JDK directory found");

  const finalDir = join(toolchainsDir(), `jdk-${version}`);
  renameSync(join(extractDir, jdkDir), finalDir);

  // Cleanup
  rmSync(extractDir, { recursive: true, force: true });
  rmSync(archivePath, { force: true });

  const javaBin = join(finalDir, "bin", osPlatform() === "win32" ? "java.exe" : "java");
  if (!existsSync(javaBin)) throw new Error("JDK installation incomplete: java binary not found");

  log(`JDK ${version} installed to ${finalDir}`);
  return { executable: javaBin, env: { JAVA_HOME: finalDir } };
}

/**
 * Resolve Java — auto-downloads from Adoptium if not found locally or in system.
 */
export async function resolveJavaWithAutoDownload(version: 8 | 11 | 17 | 21, opts: DownloadJdkOptions = {}): Promise<ResolvedTool> {
  try {
    return await resolveJava(version);
  } catch {
    return downloadJdk(version, opts);
  }
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
