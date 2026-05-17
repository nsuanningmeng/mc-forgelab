import { homedir, platform as osPlatform } from "node:os";
import { posix, win32 } from "node:path";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { JsonObject } from "@mc-forgelab/core";

export type AppMode = "cli" | "web" | "desktop" | "docker";

/**
 * 全部环境变量名集中表（用户可见 API）。变更需同步 docs/configuration.md。
 */
export const ENV_KEYS = {
  MODE: "MC_FORGELAB_MODE",
  WORKSPACE: "MC_FORGELAB_WORKSPACE",
  CACHE: "MC_FORGELAB_CACHE",
  LOGS: "MC_FORGELAB_LOGS",
  DB: "MC_FORGELAB_DB",
  TOOLCHAINS: "MC_FORGELAB_TOOLCHAINS",
  ARTIFACTS: "MC_FORGELAB_ARTIFACTS",
  HOST: "MC_FORGELAB_HOST",
  PORT: "MC_FORGELAB_PORT",
  BASE_URL: "MC_FORGELAB_BASE_URL",
  AUTH_ENABLED: "MC_FORGELAB_AUTH_ENABLED",
  ADMIN_USER: "MC_FORGELAB_ADMIN_USER",
  ADMIN_PASSWORD: "MC_FORGELAB_ADMIN_PASSWORD",
  MAX_UPLOAD_SIZE: "MC_FORGELAB_MAX_UPLOAD_SIZE",
  MAX_PROJECT_SIZE: "MC_FORGELAB_MAX_PROJECT_SIZE",
  MAX_BUILD_CONCURRENCY: "MC_FORGELAB_MAX_BUILD_CONCURRENCY",
  ARTIFACT_RETENTION_DAYS: "MC_FORGELAB_ARTIFACT_RETENTION_DAYS",
  MAX_ARTIFACT_STORAGE: "MC_FORGELAB_MAX_ARTIFACT_STORAGE",
  LOG_LEVEL: "MC_FORGELAB_LOG_LEVEL"
} as const;

export interface ResolvedPaths {
  readonly workspace: string;
  readonly cache: string;
  readonly logs: string;
  readonly db: string;
  readonly toolchains: string;
  readonly artifacts: string;
}

export interface AppConfig {
  readonly mode: AppMode;
  readonly paths: ResolvedPaths;
  readonly host: string;
  readonly port: number;
  readonly baseUrl: string | null;
  readonly auth: {
    readonly enabled: boolean;
    readonly adminUser: string | null;
    readonly adminPasswordSet: boolean;
  };
  readonly limits: {
    readonly maxUploadSizeBytes: number;
    readonly maxProjectSizeBytes: number;
    readonly maxBuildConcurrency: number;
    readonly artifactRetentionDays: number;
    readonly maxArtifactStorageBytes: number;
  };
  readonly logLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
}

export type PartialAppConfig = JsonObject;

export interface LoadConfigOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly homeDir?: string;
  /** 显式覆盖 mode；CLI 启动时常用 */
  readonly mode?: AppMode;
}

/**
 * 计算指定 mode 下的默认目录布局。
 *
 * Windows:  %LOCALAPPDATA%\MC-ForgeLab
 * macOS:    ~/Library/Application Support/MC-ForgeLab  (cache: ~/Library/Caches/MC-ForgeLab)
 * Linux:    ~/.local/share/mc-forgelab                  (cache: ~/.cache/mc-forgelab)
 * Docker:   /data 与 /opt/mc-forgelab/toolchains
 */
export function resolvePathsFor(
  mode: AppMode,
  platform: NodeJS.Platform = osPlatform(),
  home: string = homedir(),
  env: Readonly<Record<string, string | undefined>> = process.env
): ResolvedPaths {
  // 选择目标平台对应的 path 实现，避免在 Windows 测试 Linux 路径时被宿主系统污染
  const p = platform === "win32" ? win32 : posix;
  const join = p.join.bind(p);

  if (mode === "docker") {
    return {
      workspace: env[ENV_KEYS.WORKSPACE] ?? "/data/workspace",
      cache: env[ENV_KEYS.CACHE] ?? "/data/cache",
      logs: env[ENV_KEYS.LOGS] ?? "/data/logs",
      db: env[ENV_KEYS.DB] ?? "/data/db/mc-forgelab.sqlite",
      toolchains: env[ENV_KEYS.TOOLCHAINS] ?? "/opt/mc-forgelab/toolchains",
      artifacts: env[ENV_KEYS.ARTIFACTS] ?? "/data/artifacts"
    };
  }

  let base: { data: string; cache: string };
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    base = {
      data: join(localAppData, "MC-ForgeLab"),
      cache: join(localAppData, "MC-ForgeLab", "cache")
    };
  } else if (platform === "darwin") {
    base = {
      data: join(home, "Library", "Application Support", "MC-ForgeLab"),
      cache: join(home, "Library", "Caches", "MC-ForgeLab")
    };
  } else {
    base = {
      data: join(home, ".local", "share", "mc-forgelab"),
      cache: join(home, ".cache", "mc-forgelab")
    };
  }

  return {
    workspace: env[ENV_KEYS.WORKSPACE] ?? join(base.data, "workspace"),
    cache: env[ENV_KEYS.CACHE] ?? base.cache,
    logs: env[ENV_KEYS.LOGS] ?? join(base.data, "logs"),
    db: env[ENV_KEYS.DB] ?? join(base.data, "db", "mc-forgelab.sqlite"),
    toolchains: env[ENV_KEYS.TOOLCHAINS] ?? join(base.data, "toolchains"),
    artifacts: env[ENV_KEYS.ARTIFACTS] ?? join(base.data, "artifacts")
  };
}

export const defaultAppConfig: Omit<AppConfig, "paths"> = {
  mode: "cli",
  host: "127.0.0.1",
  port: 3000,
  baseUrl: null,
  auth: {
    enabled: false,
    adminUser: null,
    adminPasswordSet: false
  },
  limits: {
    maxUploadSizeBytes: 200 * 1024 * 1024,
    maxProjectSizeBytes: 2 * 1024 * 1024 * 1024,
    maxBuildConcurrency: 1,
    artifactRetentionDays: 30,
    maxArtifactStorageBytes: 20 * 1024 * 1024 * 1024
  },
  logLevel: "info"
};

/**
 * 浅校验 AppConfig；不合法时抛 AppError(CONFIG_INVALID_VALUE)。
 * Stage 1 不引入 zod/ajv，保持零运行时依赖。
 */
export function validateConfig(cfg: AppConfig): void {
  if (!["cli", "web", "desktop", "docker"].includes(cfg.mode)) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { field: "mode", value: cfg.mode }
    });
  }
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { field: "port", value: cfg.port }
    });
  }
  if (cfg.limits.maxBuildConcurrency < 1) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { field: "limits.maxBuildConcurrency", value: cfg.limits.maxBuildConcurrency }
    });
  }
  if (cfg.limits.artifactRetentionDays < 0) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { field: "limits.artifactRetentionDays", value: cfg.limits.artifactRetentionDays }
    });
  }
}
