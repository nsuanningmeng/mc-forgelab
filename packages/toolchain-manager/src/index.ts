/**
 * @mc-forgelab/toolchain-manager — 阶段 2 实施
 *
 * 职责：
 * - 管理 JDK 8/11/17/21（Windows x64、macOS x64/arm64、Linux x64）
 * - 管理 Gradle / Maven 本体（不依赖系统 PATH）
 * - Node Runtime 策略（生产打包内置）
 * - Git 弱依赖策略（默认 HTTPS zip/tar，无 Git 给友好提示）
 * - manifest.json 校验：toolName / version / platform / arch / sha256 / verified
 * - 构建时返回 { executable, args[], env: { JAVA_HOME, GRADLE_USER_HOME, ... } } 隔离环境
 */

export type ToolName = "java" | "gradle" | "maven" | "node" | "git";
export type Platform = "win32" | "darwin" | "linux";
export type Arch = "x64" | "arm64";

export interface ToolchainManifestEntry {
  readonly toolName: ToolName;
  readonly version: string;
  readonly platform: Platform;
  readonly arch: Arch;
  readonly path: string;
  readonly executablePath: string;
  readonly sha256: string;
  readonly source: string;
  readonly installedAt: string;
  readonly verified: boolean;
  readonly license: string;
  readonly compatibleTargets: ReadonlyArray<string>;
}

export interface ToolchainStatus {
  readonly toolName: ToolName;
  readonly installed: boolean;
  readonly versions: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<string>;
}

export interface ResolvedTool {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
}

export function listInstalled(): ToolchainManifestEntry[] {
  throw new Error("toolchain-manager.listInstalled: not implemented (stage 2)");
}

export async function resolveJava(_version: 8 | 11 | 17 | 21): Promise<ResolvedTool> {
  throw new Error("toolchain-manager.resolveJava: not implemented (stage 2)");
}

export async function resolveGradle(_version: string): Promise<ResolvedTool> {
  throw new Error("toolchain-manager.resolveGradle: not implemented (stage 2)");
}

export async function doctor(): Promise<ReadonlyArray<ToolchainStatus>> {
  return [];
}
