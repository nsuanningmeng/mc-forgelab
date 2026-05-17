/**
 * 目标端语义：
 * - plugin：服务端插件（Bukkit/Spigot/Paper/Purpur/Folia）
 * - mod：客户端/服务端模组（Fabric/Forge/NeoForge/Quilt）
 * - proxy：代理端插件（Velocity/BungeeCord/Waterfall）
 * - hybrid：混合端运行时（Mohist/Magma/Arclight 等，**仅运行时**，开发仍按 plugin/mod 选型）
 */
export type TargetType = "plugin" | "mod" | "proxy" | "hybrid";

export type TargetStability = "stable" | "experimental" | "legacy" | "deprecated";

export type BuildSystem = "gradle" | "maven";

export interface TargetCapabilities {
  readonly supportsPlugins: boolean;
  readonly supportsMods: boolean;
  readonly supportsProxy: boolean;
  readonly supportsPaperApi: boolean;
  readonly supportsBukkitApi: boolean;
  readonly supportsSpigotApi: boolean;
  readonly supportsForge: boolean;
  readonly supportsNeoForge: boolean;
  readonly supportsFabric: boolean;
  readonly supportsQuilt: boolean;
  readonly supportsMixin: boolean;
  readonly supportsNms: boolean;
  readonly supportsAdventure: boolean;
  readonly supportsVelocity: boolean;
  readonly supportsBungee: boolean;
  readonly supportsFoliaScheduler: boolean;
  readonly supportsHybridRuntime: boolean;
}

export interface TargetVersionConstraint {
  /** semver-ish MC 版本范围，如 ">=1.20.1 <1.21" 或精确 "1.20.1" */
  readonly minecraftRange: string;
  /** 推荐 Java 版本（含），如 17 */
  readonly recommendedJava: number;
  /** 允许的 Java 版本集合 */
  readonly supportedJava: ReadonlyArray<number>;
  /** 推荐 Gradle 版本（含次版本号），如 "8.10" */
  readonly recommendedGradle?: string;
  readonly supportedGradle?: ReadonlyArray<string>;
}

export interface Target {
  readonly id: string;
  readonly displayName: string;
  readonly type: TargetType;
  readonly stability: TargetStability;
  readonly recommendedBuildTool: BuildSystem;
  readonly versionConstraints: ReadonlyArray<TargetVersionConstraint>;
  readonly templateIds: ReadonlyArray<string>;
  readonly docsUrl: string;
  readonly warningsZh: ReadonlyArray<string>;
  readonly warningsEn: ReadonlyArray<string>;
  readonly experimental: boolean;
  readonly legacy: boolean;
  readonly deprecated: boolean;
  readonly capabilities: TargetCapabilities;
}

/** 列表展示用的精简结构 */
export interface TargetSummary {
  readonly id: string;
  readonly displayName: string;
  readonly type: TargetType;
  readonly stability: TargetStability;
  readonly recommendedBuildTool: BuildSystem;
  readonly templateIds: ReadonlyArray<string>;
}

export function summarize(t: Target): TargetSummary {
  return {
    id: t.id,
    displayName: t.displayName,
    type: t.type,
    stability: t.stability,
    recommendedBuildTool: t.recommendedBuildTool,
    templateIds: t.templateIds
  };
}
