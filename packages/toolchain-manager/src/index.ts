import { existsSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { platform as osPlatform, arch as osArch, homedir } from "node:os";
import { execSync, spawnSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { Agent as HttpsAgent, get as httpsGet, request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";
import type { Duplex } from "node:stream";
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
  readonly requestedVersion?: string;
  readonly path?: string;
  readonly issues: ReadonlyArray<string>;
}

export interface ProxyConfig {
  readonly http?: string;
  readonly https?: string;
  readonly noProxy?: string;
}

interface ExecResult {
  readonly command: string;
  readonly path: string;
  readonly output: string;
}

function toolchainsDir(): string {
  // Honor the documented MC_FORGELAB_TOOLCHAINS override so tests/e2e runs
  // never install JDKs into the real per-user toolchain directory.
  const override = process.env.MC_FORGELAB_TOOLCHAINS;
  if (override && override.trim().length > 0) return override;
  const p = osPlatform();
  const h = homedir();
  if (p === "win32") return join(process.env.LOCALAPPDATA ?? join(h, "AppData", "Local"), "MC-ForgeLab", "toolchains");
  if (p === "darwin") return join(h, "Library", "Application Support", "MC-ForgeLab", "toolchains");
  return join(h, ".local", "share", "mc-forgelab", "toolchains");
}

function outputToString(output: string | Buffer | null | undefined): string {
  if (typeof output === "string") return output;
  return output?.toString("utf8") ?? "";
}

function needsShell(command: string): boolean {
  return osPlatform() === "win32" && /\.(?:bat|cmd)$/i.test(command);
}

export interface ExecAttempt {
  readonly cmd: string;
  readonly ok: boolean;
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export function tryExecFull(cmd: string, args: string[]): ExecAttempt {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: needsShell(cmd),
    timeout: 5000,
    windowsHide: true
  });
  const stdout = outputToString(result.stdout);
  const stderr = outputToString(result.stderr);
  if (result.error) {
    return { cmd, ok: false, status: null, stdout, stderr, error: result.error.message };
  }
  if (result.status !== 0) {
    return { cmd, ok: false, status: result.status, stdout, stderr, error: `exit code ${result.status}` };
  }
  return { cmd, ok: true, status: 0, stdout, stderr, error: null };
}

function tryExec(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: needsShell(cmd),
    timeout: 5000,
    windowsHide: true
  });
  if (result.error || result.status !== 0) return null;

  const output = [outputToString(result.stdout), outputToString(result.stderr)]
    .filter((part) => part.trim().length > 0)
    .join("\n")
    .trim();
  return output.length > 0 ? output : null;
}

function firstLine(output: string | null): string | null {
  return output?.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? null;
}

function commandPath(command: string): string {
  if (command.includes("/") || command.includes("\\")) return command;
  const lookup = osPlatform() === "win32" ? tryExec("where.exe", [command]) : tryExec("which", [command]);
  return firstLine(lookup) ?? command;
}

function tryExecFirst(commands: ReadonlyArray<string>, args: string[]): ExecResult | null {
  for (const command of commands) {
    const output = tryExec(command, args);
    if (output) return { command, path: commandPath(command), output };
  }
  return null;
}

export function parseJavaMajor(output: string | null): number | null {
  const match = /version\s+"(?:(1)\.)?(\d+)/i.exec(output ?? "");
  if (!match?.[2]) return null;
  return Number.parseInt(match[2], 10);
}

function formatJavaVersion(output: string | null): string | null {
  const major = parseJavaMajor(output);
  const line = firstLine(output);
  if (major !== null && line) return `${major} (${line})`;
  if (major !== null) return String(major);
  return line;
}

function parseGradleVersion(output: string): string | null {
  return /Gradle\s+([^\s]+)/i.exec(output)?.[1] ?? null;
}

function parseMavenVersion(output: string): string | null {
  return /Apache Maven\s+([^\s]+)/i.exec(output)?.[1] ?? null;
}

function inspectSystemTool(
  toolName: "gradle" | "maven",
  commands: ReadonlyArray<string>,
  args: string[],
  parseVersion: (output: string) => string | null,
  missingIssue: string
): ToolchainStatus {
  let lastAttempt: ExecAttempt | null = null;
  for (const command of commands) {
    const attempt = tryExecFull(command, args);
    if (attempt.ok) {
      const output = [attempt.stdout, attempt.stderr].filter((p) => p.trim().length > 0).join("\n").trim();
      const version = parseVersion(output) ?? firstLine(output);
      return {
        toolName,
        installed: true,
        version,
        path: commandPath(command),
        issues: version ? [] : [`Unable to parse ${toolName} version.`]
      };
    }
    lastAttempt = attempt;
  }
  const detail = lastAttempt?.error ?? missingIssue;
  return { toolName, installed: false, version: null, issues: [detail] };
}

/** Resolve Java executable — prefers managed toolchain, falls back to system java */
export async function resolveJava(version: 8 | 11 | 17 | 21): Promise<ResolvedTool> {
  const managed = join(toolchainsDir(), `jdk-${version}`, "bin", osPlatform() === "win32" ? "java.exe" : "java");
  if (existsSync(managed)) {
    const javaHome = join(toolchainsDir(), `jdk-${version}`);
    return { executable: managed, env: { JAVA_HOME: javaHome } };
  }
  // Fall back to system java only when it is a JDK of the requested major
  // version. Accepting any java here skips the Adoptium download and later
  // breaks Gradle toolchain resolution with a confusing "no matching
  // toolchains" error (wrong major, or a JRE without javac).
  const sysJava = osPlatform() === "win32" ? "java.exe" : "java";
  const ver = tryExec(sysJava, ["-version"]);
  if (ver && parseJavaMajor(ver) === version) {
    const javaPath = commandPath(sysJava);
    const binDir = dirname(javaPath);
    const javacName = osPlatform() === "win32" ? "javac.exe" : "javac";
    if (javaPath !== sysJava && existsSync(join(binDir, javacName))) {
      return { executable: javaPath, env: { JAVA_HOME: dirname(binDir) } };
    }
  }
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

/** Resolve Maven wrapper in project dir, or fall back to system mvn. */
export async function resolveMavenWrapper(projectDir: string): Promise<ResolvedTool> {
  const wrapper = osPlatform() === "win32" ? join(projectDir, "mvnw.cmd") : join(projectDir, "mvnw");
  if (existsSync(wrapper)) {
    if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapper] };
    return { executable: wrapper, env: {} };
  }
  const detected = tryExecFirst(osPlatform() === "win32" ? ["mvn.cmd", "mvn"] : ["mvn"], ["--version"]);
  if (detected) {
    if (osPlatform() === "win32" && /\.(?:bat|cmd)$/i.test(detected.command)) {
      return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", detected.command] };
    }
    return { executable: detected.command, env: {} };
  }
  throw new Error("Maven wrapper not found and no system mvn available.");
}

interface AdoptiumPackage { link: string; name: string; size: number }

// /v3/assets/latest nests the package under `binary`; keep the flat shape
// as a fallback in case the API ever returns it directly.
interface AdoptiumBinary {
  binary?: { package?: AdoptiumPackage };
  package?: AdoptiumPackage;
}

function readProxyConfig(proxy?: ProxyConfig): ProxyConfig {
  return {
    http: proxy?.http ?? process.env.MC_FORGELAB_PROXY_HTTP,
    https: proxy?.https ?? process.env.MC_FORGELAB_PROXY_HTTPS,
    noProxy: proxy?.noProxy ?? process.env.MC_FORGELAB_PROXY_NO_PROXY,
  };
}

function proxyPort(proxy: URL): number {
  if (proxy.port) return Number.parseInt(proxy.port, 10);
  return proxy.protocol === "https:" ? 443 : 80;
}

function proxyAuthorization(proxy: URL): string | undefined {
  if (!proxy.username && !proxy.password) return undefined;
  const username = decodeURIComponent(proxy.username);
  const password = decodeURIComponent(proxy.password);
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function parseProxyUrl(proxyUrl: string): URL {
  return new URL(/^https?:\/\//i.test(proxyUrl) ? proxyUrl : `http://${proxyUrl}`);
}

function bypassesProxy(targetUrl: URL, noProxy: string | undefined): boolean {
  const host = targetUrl.hostname.toLowerCase();
  return (noProxy ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => {
      if (entry === "*") return true;
      const [entryHost] = entry.split(":");
      if (!entryHost) return false;
      const normalized = entryHost.startsWith(".") ? entryHost.slice(1) : entryHost;
      return host === normalized || host.endsWith(`.${normalized}`);
    });
}

class HttpsProxyAgent extends HttpsAgent {
  constructor(private readonly proxyUrl: URL) {
    super();
  }

  override createConnection(
    options: Parameters<HttpsAgent["createConnection"]>[0],
    callback?: Parameters<HttpsAgent["createConnection"]>[1]
  ): ReturnType<HttpsAgent["createConnection"]> {
    const targetHost = String(options.host ?? options.hostname ?? "");
    const targetPort = Number(options.port ?? 443);
    const auth = proxyAuthorization(this.proxyUrl);
    const connectRequest = (this.proxyUrl.protocol === "https:" ? httpsRequest : httpRequest)({
      host: this.proxyUrl.hostname,
      port: proxyPort(this.proxyUrl),
      method: "CONNECT",
      path: `${targetHost}:${targetPort}`,
      headers: {
        Host: `${targetHost}:${targetPort}`,
        ...(auth ? { "Proxy-Authorization": auth } : {}),
      },
    });

    let settled = false;
    const done = (err: Error | null, socket?: Duplex) => {
      if (settled) return;
      settled = true;
      callback?.(err, socket as Duplex);
    };

    connectRequest.once("connect", (res, socket, head) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        done(new Error(`Proxy CONNECT failed: HTTP ${res.statusCode ?? 0}`));
        return;
      }
      if (head.length > 0) socket.unshift(head);
      const tlsSocket = tlsConnect({
        socket,
        servername: typeof options.servername === "string" ? options.servername : targetHost,
      });
      tlsSocket.once("secureConnect", () => done(null, tlsSocket));
      tlsSocket.once("error", (error) => done(error));
    });
    connectRequest.once("error", (error) => done(error));
    connectRequest.end();

    return undefined;
  }
}

export function getProxyAgent(target: string | URL = "https://example.invalid", proxy?: ProxyConfig): HttpsAgent | undefined {
  const targetUrl = target instanceof URL ? target : new URL(target);
  const proxyConfig = readProxyConfig(proxy);
  if (bypassesProxy(targetUrl, proxyConfig.noProxy)) return undefined;

  const proxyUrl = targetUrl.protocol === "https:" ? proxyConfig.https ?? proxyConfig.http : proxyConfig.http;
  if (!proxyUrl) return undefined;
  const parsedProxy = parseProxyUrl(proxyUrl);
  if (targetUrl.protocol !== "https:") return undefined;
  return new HttpsProxyAgent(parsedProxy);
}

async function fetchJson<T>(url: string, proxy?: ProxyConfig): Promise<T> {
  return new Promise((resolve, reject) => {
    httpsGet(url, { headers: { Accept: "application/json" }, agent: getProxyAgent(url, proxy) }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson<T>(new URL(res.headers.location!, url).toString(), proxy).then(resolve, reject);
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

async function downloadFile(url: string, dest: string, proxy?: ProxyConfig, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Download canceled."));
      return;
    }
    let currentRequest: ReturnType<typeof httpsGet> | null = null;
    const onAbort = () => { currentRequest?.destroy(new Error("Download canceled.")); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const settleResolve = () => { cleanup(); resolve(); };
    const settleReject = (err: unknown) => { cleanup(); reject(err); };
    const follow = (u: string) => {
      currentRequest = httpsGet(u, { agent: getProxyAgent(u, proxy) }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(new URL(res.headers.location!, u).toString());
          return;
        }
        if (res.statusCode !== 200) {
          settleReject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        pipeline(res, createWriteStream(dest), { signal }).then(settleResolve, settleReject);
      });
      currentRequest.on("error", settleReject);
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
  readonly proxy?: ProxyConfig;
  /** Aborting cancels in-flight toolchain downloads. */
  readonly signal?: AbortSignal;
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
  const assets = await fetchJson<AdoptiumBinary[]>(api, opts.proxy);
  const pkg = assets[0]?.binary?.package ?? assets[0]?.package;
  if (!pkg?.link) {
    throw new Error(`No Adoptium JDK ${version} found for ${os}/${arch}`);
  }
  const ext = os === "windows" ? "zip" : "tar.gz";
  const archivePath = join(toolchainsDir(), `jdk-${version}-download.${ext}`);

  mkdirSync(toolchainsDir(), { recursive: true });
  log(`Downloading JDK ${version} (${(pkg.size / 1024 / 1024).toFixed(0)} MB)...`);
  await downloadFile(pkg.link, archivePath, opts.proxy, opts.signal);
  if (opts.signal?.aborted) throw new Error("Download canceled.");

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

/**
 * Bootstrap Gradle wrapper in a project directory by downloading from Gradle distribution.
 * Skips if gradlew already exists.
 */
export async function bootstrapGradleWrapper(projectDir: string, version = "8.8", opts: DownloadJdkOptions = {}): Promise<ResolvedTool> {
  const log = opts.onProgress ?? (() => {});
  const wrapperScript = osPlatform() === "win32" ? "gradlew.bat" : "gradlew";
  const wrapperPath = join(projectDir, wrapperScript);

  if (existsSync(wrapperPath)) {
    if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapperPath] };
    return { executable: wrapperPath, env: {} };
  }

  const wrapperJar = join(projectDir, "gradle", "wrapper", "gradle-wrapper.jar");
  const wrapperProps = join(projectDir, "gradle", "wrapper", "gradle-wrapper.properties");
  mkdirSync(join(projectDir, "gradle", "wrapper"), { recursive: true });

  // Download gradle-wrapper.jar from official Gradle GitHub.
  // Gradle GitHub tags are always three-part (v8.8.0), while distribution
  // versions drop the trailing .0 (8.8) — normalize or the URL 404s.
  if (!existsSync(wrapperJar)) {
    log(`Downloading Gradle ${version} wrapper...`);
    const tagVersion = /^\d+\.\d+$/.test(version) ? `${version}.0` : version;
    const jarUrl = `https://raw.githubusercontent.com/gradle/gradle/v${tagVersion}/gradle/wrapper/gradle-wrapper.jar`;
    await downloadFile(jarUrl, wrapperJar, opts.proxy, opts.signal);
  }

  // Generate gradle-wrapper.properties
  if (!existsSync(wrapperProps)) {
    const { writeFileSync: writeFile } = await import("node:fs");
    writeFile(wrapperProps, [
      `distributionBase=GRADLE_USER_HOME`,
      `distributionPath=wrapper/dists`,
      `distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-bin.zip`,
      `zipStoreBase=GRADLE_USER_HOME`,
      `zipStorePath=wrapper/dists`,
      ``,
    ].join("\n"));
  }

  // Generate gradlew / gradlew.bat scripts
  const { writeFileSync: writeFile, chmodSync } = await import("node:fs");
  if (osPlatform() === "win32") {
    writeFile(wrapperPath, GRADLEW_BAT);
  } else {
    writeFile(wrapperPath, GRADLEW_SH);
    chmodSync(wrapperPath, 0o755);
  }

  log(`Gradle wrapper ${version} bootstrapped in ${projectDir}`);
  if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapperPath] };
  return { executable: wrapperPath, env: {} };
}

const MAVEN_WRAPPER_JAR_URL = "https://dlcdn.apache.org/maven/mvnd/maven-wrapper/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar";

/**
 * Bootstrap Maven wrapper in a project directory.
 * Skips if mvnw already exists.
 */
export async function bootstrapMavenWrapper(projectDir: string, version = "3.9.9", opts: DownloadJdkOptions = {}): Promise<ResolvedTool> {
  const log = opts.onProgress ?? (() => {});
  const wrapperScript = osPlatform() === "win32" ? "mvnw.cmd" : "mvnw";
  const wrapperPath = join(projectDir, wrapperScript);
  if (existsSync(wrapperPath)) {
    if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapperPath] };
    return { executable: wrapperPath, env: {} };
  }
  const wrapperDir = join(projectDir, ".mvn", "wrapper");
  const wrapperJar = join(wrapperDir, "maven-wrapper.jar");
  const wrapperProps = join(wrapperDir, "maven-wrapper.properties");
  mkdirSync(wrapperDir, { recursive: true });
  if (!existsSync(wrapperJar)) {
    log("Downloading Maven wrapper...");
    await downloadFile(MAVEN_WRAPPER_JAR_URL, wrapperJar, opts.proxy, opts.signal);
  }
  const { writeFileSync: writeFile, chmodSync } = await import("node:fs");
  if (!existsSync(wrapperProps)) {
    writeFile(wrapperProps, [
      `distributionUrl=https\\://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/${version}/apache-maven-${version}-bin.zip`,
      `wrapperUrl=${MAVEN_WRAPPER_JAR_URL}`,
      ``,
    ].join("\n"));
  }
  if (osPlatform() === "win32") {
    writeFile(wrapperPath, MVNW_CMD);
  } else {
    writeFile(wrapperPath, MVNW_SH);
    chmodSync(wrapperPath, 0o755);
  }
  log(`Maven wrapper ${version} bootstrapped in ${projectDir}`);
  if (osPlatform() === "win32") return { executable: "cmd.exe", env: {}, args: ["/d", "/s", "/c", wrapperPath] };
  return { executable: wrapperPath, env: {} };
}

const MVNW_SH = `#!/bin/sh
# Maven startup script for POSIX generated by ForgeLab
DIRNAME=\$(dirname "\$0")
APP_HOME=\$(cd "\$DIRNAME" && pwd -P) || exit
MAVEN_PROJECTBASEDIR=\${MAVEN_BASEDIR:-"\$APP_HOME"}
WRAPPER_JAR="\$APP_HOME/.mvn/wrapper/maven-wrapper.jar"
if [ ! -f "\$WRAPPER_JAR" ]; then
  echo "maven-wrapper.jar not found. Run: mcforgelab toolchain install maven"
  exit 1
fi
exec java \$MAVEN_OPTS "-Dmaven.multiModuleProjectDirectory=\$MAVEN_PROJECTBASEDIR" -classpath "\$WRAPPER_JAR" org.apache.maven.wrapper.MavenWrapperMain "\$@"
`;

const MVNW_CMD = `@rem Maven startup script for Windows generated by ForgeLab
@if "%DEBUG%"=="" @echo off
set DIRNAME=%~dp0
set APP_HOME=%DIRNAME%
set MAVEN_PROJECTBASEDIR=%APP_HOME%
set WRAPPER_JAR=%APP_HOME%\\.mvn\\wrapper\\maven-wrapper.jar
if not exist "%WRAPPER_JAR%" (
  echo maven-wrapper.jar not found. Run: mcforgelab toolchain install maven
  exit /b 1
)
java %MAVEN_OPTS% "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
`;

const GRADLEW_SH = `#!/bin/sh
# Gradle start up script for POSIX generated by ForgeLab
APP_NAME="Gradle"
APP_BASE_NAME=\$(basename "\$0")
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'
MAX_FD=maximum
warn () { echo "\$*"; }
die () { echo; echo "\$*"; echo; exit 1; }
DIRNAME=\$(dirname "\$0")
APP_HOME=\$(cd "\$DIRNAME" && pwd -P) || exit
CLASSPATH=\$APP_HOME/gradle/wrapper/gradle-wrapper.jar
if [ ! -f "\$CLASSPATH" ]; then
  echo "gradle-wrapper.jar not found. Run: mcforgelab toolchain install gradle"
  exit 1
fi
exec java \$DEFAULT_JVM_OPTS \$JAVA_OPTS \$GRADLE_OPTS "-Dorg.gradle.appname=\$APP_BASE_NAME" -classpath "\$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "\$@"
`;

const GRADLEW_BAT = `@rem Gradle startup script for Windows generated by ForgeLab
@if "%DEBUG%"=="" @echo off
set DIRNAME=%~dp0
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"
set CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar
if not exist "%CLASSPATH%" (
  echo gradle-wrapper.jar not found. Run: mcforgelab toolchain install gradle
  exit /b 1
)
java %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
`;

export async function doctor(): Promise<ReadonlyArray<ToolchainStatus>> {
  const results: ToolchainStatus[] = [];
  const systemJava = tryExecFirst([osPlatform() === "win32" ? "java.exe" : "java"], ["-version"]);
  const systemJavaMajor = parseJavaMajor(systemJava?.output ?? null);

  for (const v of [8, 11, 17, 21] as const) {
    const managed = join(toolchainsDir(), `jdk-${v}`, "bin", osPlatform() === "win32" ? "java.exe" : "java");
    if (existsSync(managed)) {
      const versionOutput = tryExec(managed, ["-version"]);
      const major = parseJavaMajor(versionOutput);
      const issues: string[] = [];
      if (!versionOutput) {
        issues.push(`Managed JDK ${v} exists but could not be executed.`);
      } else if (major !== v) {
        issues.push(`Managed JDK ${v} reports Java ${major ?? "unknown"}.`);
      }

      results.push({
        toolName: "java",
        requestedVersion: String(v),
        installed: versionOutput !== null && major === v,
        version: formatJavaVersion(versionOutput),
        path: managed,
        issues
      });
      continue;
    }

    if (systemJava) {
      if (systemJavaMajor === v) {
        results.push({
          toolName: "java",
          requestedVersion: String(v),
          installed: true,
          version: formatJavaVersion(systemJava.output),
          path: systemJava.path,
          issues: [`Managed JDK ${v} not installed; using system Java fallback.`]
        });
      } else {
        results.push({
          toolName: "java",
          requestedVersion: String(v),
          installed: false,
          version: formatJavaVersion(systemJava.output),
          path: systemJava.path,
          issues: [`Managed JDK ${v} not installed; system Java is ${systemJavaMajor ?? "unknown"}.`]
        });
      }
      continue;
    }

    results.push({
      toolName: "java",
      requestedVersion: String(v),
      installed: false,
      version: null,
      issues: [`Java ${v} not found. Install via: mcforgelab toolchain install java --version ${v}`]
    });
  }

  results.push(inspectSystemTool(
    "gradle",
    osPlatform() === "win32" ? ["gradle", "gradle.bat"] : ["gradle"],
    ["--version"],
    parseGradleVersion,
    "Gradle not found. Install Gradle or add it to PATH."
  ));
  results.push(inspectSystemTool(
    "maven",
    osPlatform() === "win32" ? ["mvn", "mvn.cmd"] : ["mvn"],
    ["--version"],
    parseMavenVersion,
    "Maven not found. Install Maven or add it to PATH."
  ));

  return results;
}
