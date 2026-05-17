import { homedir, platform as osPlatform } from "node:os";
import {
  type AppConfig,
  type AppMode,
  type LoadConfigOptions,
  defaultAppConfig,
  resolvePathsFor,
  ENV_KEYS,
  validateConfig
} from "./schema.js";
import { readEnv, parseBoolean, parseInteger, parseSize, parseLogLevel, parseMode } from "./env.js";

/**
 * 主入口：合并优先级 env > 默认值。
 * 阶段 1 不读取 JSON 文件；阶段 6 引入 user config file 时再扩展。
 */
export function loadConfig(opts: LoadConfigOptions = {}): AppConfig {
  const env: Readonly<Record<string, string | undefined>> = opts.env ?? process.env;
  const platform: NodeJS.Platform = opts.platform ?? osPlatform();
  const home: string = opts.homeDir ?? homedir();

  const mode: AppMode = opts.mode ?? parseMode(readEnv(env, ENV_KEYS.MODE), defaultAppConfig.mode);
  const paths = resolvePathsFor(mode, platform, home, env);

  const config: AppConfig = {
    mode,
    paths,
    host: readEnv(env, ENV_KEYS.HOST) ?? defaultAppConfig.host,
    port: parseInteger(readEnv(env, ENV_KEYS.PORT), defaultAppConfig.port),
    baseUrl: readEnv(env, ENV_KEYS.BASE_URL) ?? defaultAppConfig.baseUrl,
    auth: {
      enabled: parseBoolean(readEnv(env, ENV_KEYS.AUTH_ENABLED), defaultAppConfig.auth.enabled),
      adminUser: readEnv(env, ENV_KEYS.ADMIN_USER) ?? defaultAppConfig.auth.adminUser,
      adminPasswordSet: readEnv(env, ENV_KEYS.ADMIN_PASSWORD) !== undefined
    },
    limits: {
      maxUploadSizeBytes: parseSize(readEnv(env, ENV_KEYS.MAX_UPLOAD_SIZE), defaultAppConfig.limits.maxUploadSizeBytes),
      maxProjectSizeBytes: parseSize(readEnv(env, ENV_KEYS.MAX_PROJECT_SIZE), defaultAppConfig.limits.maxProjectSizeBytes),
      maxBuildConcurrency: parseInteger(
        readEnv(env, ENV_KEYS.MAX_BUILD_CONCURRENCY),
        defaultAppConfig.limits.maxBuildConcurrency
      ),
      artifactRetentionDays: parseInteger(
        readEnv(env, ENV_KEYS.ARTIFACT_RETENTION_DAYS),
        defaultAppConfig.limits.artifactRetentionDays
      ),
      maxArtifactStorageBytes: parseSize(
        readEnv(env, ENV_KEYS.MAX_ARTIFACT_STORAGE),
        defaultAppConfig.limits.maxArtifactStorageBytes
      )
    },
    logLevel: parseLogLevel(readEnv(env, ENV_KEYS.LOG_LEVEL), defaultAppConfig.logLevel)
  };

  validateConfig(config);
  return config;
}

/**
 * 对象式 loader，便于在 IoC 容器中按需复用。
 */
export class ConfigLoader {
  constructor(private readonly options: LoadConfigOptions = {}) {}
  load(overrides: Partial<LoadConfigOptions> = {}): AppConfig {
    return loadConfig({ ...this.options, ...overrides });
  }
}
