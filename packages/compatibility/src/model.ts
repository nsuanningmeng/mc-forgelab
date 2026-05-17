import type { Target } from "@mc-forgelab/target-registry";

export type CompatibilityLevel = "info" | "warning" | "error";

export interface MinecraftVersionRecord {
  readonly minecraftVersion: string;
  readonly recommendedJavaVersion: 8 | 11 | 17 | 21;
  readonly supportedJavaVersions: ReadonlyArray<8 | 11 | 17 | 21>;
  readonly recommendedGradleVersion: string;
  readonly supportedGradleVersions: ReadonlyArray<string>;
  readonly supportedTargets: ReadonlyArray<string>;
  readonly legacy: boolean;
  readonly recommendedForProduction: boolean;
  readonly notesZh: string;
  readonly notesEn: string;
  readonly knownIssuesZh: ReadonlyArray<string>;
  readonly knownIssuesEn: ReadonlyArray<string>;
}

/**
 * 阶段 1 内置版本矩阵。未来版本由 JSON loader 动态扩展。
 */
export const MINECRAFT_VERSIONS: ReadonlyArray<MinecraftVersionRecord> = [
  {
    minecraftVersion: "1.8.8",
    recommendedJavaVersion: 8,
    supportedJavaVersions: [8],
    recommendedGradleVersion: "4.10.3",
    supportedGradleVersions: ["4.10.3", "5.6.4"],
    supportedTargets: [],
    legacy: true,
    recommendedForProduction: false,
    notesZh: "极旧版本，仅作为遗留支持参考。",
    notesEn: "Very old version, kept only for legacy reference.",
    knownIssuesZh: ["大部分现代构建插件不再支持。"],
    knownIssuesEn: ["Most modern build plugins no longer support it."]
  },
  {
    minecraftVersion: "1.12.2",
    recommendedJavaVersion: 8,
    supportedJavaVersions: [8],
    recommendedGradleVersion: "5.6.4",
    supportedGradleVersions: ["4.10.3", "5.6.4"],
    supportedTargets: [],
    legacy: true,
    recommendedForProduction: false,
    notesZh: "ForgeGradle 老版本通常仅支持 Java 8。",
    notesEn: "Legacy ForgeGradle typically only supports Java 8.",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.16.5",
    recommendedJavaVersion: 8,
    supportedJavaVersions: [8, 11],
    recommendedGradleVersion: "7.5.1",
    supportedGradleVersions: ["7.5.1"],
    supportedTargets: ["paper", "fabric"],
    legacy: true,
    recommendedForProduction: false,
    notesZh: "Forge 36.x 时代，需要旧 Java。",
    notesEn: "Forge 36.x era, requires legacy Java.",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.18.2",
    recommendedJavaVersion: 17,
    supportedJavaVersions: [17],
    recommendedGradleVersion: "7.5.1",
    supportedGradleVersions: ["7.5.1", "8.0"],
    supportedTargets: ["paper", "fabric"],
    legacy: false,
    recommendedForProduction: false,
    notesZh: "Minecraft 首个要求 Java 17 的版本。",
    notesEn: "First Minecraft version to require Java 17.",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.19.4",
    recommendedJavaVersion: 17,
    supportedJavaVersions: [17],
    recommendedGradleVersion: "8.0",
    supportedGradleVersions: ["8.0", "8.4"],
    supportedTargets: ["paper", "fabric", "velocity"],
    legacy: false,
    recommendedForProduction: false,
    notesZh: "",
    notesEn: "",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.20.1",
    recommendedJavaVersion: 17,
    supportedJavaVersions: [17, 21],
    recommendedGradleVersion: "8.5",
    supportedGradleVersions: ["8.5", "8.7"],
    supportedTargets: ["paper", "fabric", "velocity"],
    legacy: false,
    recommendedForProduction: true,
    notesZh: "稳定版本，被广泛部署。",
    notesEn: "Stable release, widely deployed.",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.20.4",
    recommendedJavaVersion: 17,
    supportedJavaVersions: [17, 21],
    recommendedGradleVersion: "8.7",
    supportedGradleVersions: ["8.7"],
    supportedTargets: ["paper", "fabric", "velocity"],
    legacy: false,
    recommendedForProduction: true,
    notesZh: "",
    notesEn: "",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.20.6",
    recommendedJavaVersion: 21,
    supportedJavaVersions: [21],
    recommendedGradleVersion: "8.8",
    supportedGradleVersions: ["8.8"],
    supportedTargets: ["paper", "fabric", "velocity"],
    legacy: false,
    recommendedForProduction: true,
    notesZh: "首个推荐 Java 21 的版本。",
    notesEn: "First version recommending Java 21.",
    knownIssuesZh: [],
    knownIssuesEn: []
  },
  {
    minecraftVersion: "1.21.1",
    recommendedJavaVersion: 21,
    supportedJavaVersions: [21],
    recommendedGradleVersion: "8.10",
    supportedGradleVersions: ["8.10"],
    supportedTargets: ["paper", "fabric", "velocity"],
    legacy: false,
    recommendedForProduction: true,
    notesZh: "",
    notesEn: "",
    knownIssuesZh: [],
    knownIssuesEn: []
  }
];

export function getMinecraftVersion(version: string): MinecraftVersionRecord | undefined {
  return MINECRAFT_VERSIONS.find((v) => v.minecraftVersion === version);
}

/**
 * 兼容性检查上下文。所有调用方在 UI 流程中构造此对象。
 */
export interface CompatibilityContext {
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildSystem?: "gradle" | "maven";
  readonly gradleVersion?: string;
  /** 用户在向导中是否声明使用 NMS */
  readonly usesNms?: boolean;
  /** 是否在 Folia 上声明使用 Folia Scheduler */
  readonly usesFoliaScheduler?: boolean;
  /** 是否在 Folia 目标上声明使用旧 Bukkit Scheduler（不安全） */
  readonly usesBukkitScheduler?: boolean;
  readonly usesMixin?: boolean;
  /**
   * 声明的部署平台：UI 用户可能在 Velocity 目标下错填 "paper"，规则用于阻断。
   */
  readonly declaredPlatform?: "paper" | "spigot" | "bukkit" | "purpur" | "folia" | "velocity" | "bungee" | "fabric" | "forge" | "neoforge" | "quilt";
}

export interface CheckResult {
  readonly level: CompatibilityLevel;
  readonly code: string;
  readonly messageZh: string;
  readonly messageEn: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
  readonly blocking: boolean;
}

export interface CompatibilityRule {
  readonly id: string;
  readonly descriptionZh: string;
  readonly descriptionEn: string;
  readonly appliesToTargetIds?: ReadonlyArray<string>;
  evaluate(context: CompatibilityContext, target: Target): ReadonlyArray<CheckResult>;
}
