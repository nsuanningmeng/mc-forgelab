import type { CheckResult, CompatibilityContext, CompatibilityRule } from "./model.js";
import { getMinecraftVersion } from "./model.js";

const ok = (
  partial: Omit<CheckResult, "level" | "blocking"> & { level: CheckResult["level"]; blocking?: boolean }
): CheckResult => ({
  level: partial.level,
  code: partial.code,
  messageZh: partial.messageZh,
  messageEn: partial.messageEn,
  ...(partial.fixSuggestionZh ? { fixSuggestionZh: partial.fixSuggestionZh } : {}),
  ...(partial.fixSuggestionEn ? { fixSuggestionEn: partial.fixSuggestionEn } : {}),
  blocking: partial.blocking ?? false
});

export const RULE_VELOCITY_NOT_BUKKIT: CompatibilityRule = {
  id: "VELOCITY_NOT_BUKKIT_PLUGIN",
  descriptionZh: "Velocity 不能作为 Bukkit 派生服务端的插件运行。",
  descriptionEn: "Velocity is not a Bukkit fork; its plugins cannot run on Paper/Spigot.",
  appliesToTargetIds: ["velocity"],
  evaluate(ctx) {
    const bukkitFamily = ["paper", "spigot", "bukkit", "purpur", "folia"];
    if (ctx.declaredPlatform && bukkitFamily.includes(ctx.declaredPlatform)) {
      return [
        ok({
          level: "error",
          code: "VELOCITY_NOT_BUKKIT_PLUGIN",
          messageZh: "Velocity 插件不能部署在 Paper/Spigot/Bukkit/Purpur/Folia 上。",
          messageEn: "Velocity plugins cannot be deployed on Paper/Spigot/Bukkit/Purpur/Folia.",
          fixSuggestionZh: "若希望部署在 Bukkit 派生服务端，请选择 Paper 目标。",
          fixSuggestionEn: "Switch to the Paper target if deploying on Bukkit-family servers.",
          blocking: true
        })
      ];
    }
    return [];
  }
};

export const RULE_FOLIA_SCHEDULER: CompatibilityRule = {
  id: "FOLIA_UNSAFE_BUKKIT_SCHEDULER",
  descriptionZh: "Folia 上不能使用旧的全局 BukkitScheduler。",
  descriptionEn: "Folia does not allow the legacy global BukkitScheduler.",
  appliesToTargetIds: ["folia"],
  evaluate(ctx) {
    if (ctx.declaredPlatform === "folia" && ctx.usesBukkitScheduler) {
      return [
        ok({
          level: "error",
          code: "FOLIA_UNSAFE_BUKKIT_SCHEDULER",
          messageZh: "Folia 必须使用 Region/Global Scheduler，不能继续使用 Bukkit Scheduler。",
          messageEn: "Folia requires Region/Global Scheduler; the legacy Bukkit Scheduler is unsafe.",
          fixSuggestionZh: "改用 Bukkit#getRegionScheduler / Bukkit#getGlobalRegionScheduler。",
          fixSuggestionEn: "Use Bukkit#getRegionScheduler / Bukkit#getGlobalRegionScheduler instead.",
          blocking: true
        })
      ];
    }
    return [];
  }
};

export const RULE_NMS_VERSION_LOCK: CompatibilityRule = {
  id: "NMS_VERSION_LOCK",
  descriptionZh: "声明使用 NMS 的插件强绑定 Minecraft 小版本，升级有破坏性风险。",
  descriptionEn: "Plugins using NMS are tightly coupled to a specific Minecraft patch version.",
  evaluate(ctx, target) {
    if (ctx.usesNms && target.capabilities.supportsNms) {
      return [
        ok({
          level: "warning",
          code: "NMS_VERSION_LOCK",
          messageZh: `当前目标 ${target.displayName} 与 MC ${ctx.minecraftVersion} 的 NMS 绑定，请准备版本隔离层。`,
          messageEn: `Target ${target.displayName} pinned to MC ${ctx.minecraftVersion} via NMS; isolate version-specific code.`,
          fixSuggestionZh: "为不同 MC 版本拆分子模块或使用反射访问 NMS。",
          fixSuggestionEn: "Split per-version submodules or access NMS via reflection.",
          blocking: false
        })
      ];
    }
    return [];
  }
};

export const RULE_JAVA_VERSION_RANGE: CompatibilityRule = {
  id: "JAVA_VERSION_OUT_OF_RANGE",
  descriptionZh: "所选 Java 版本不在目标支持范围内。",
  descriptionEn: "Selected Java version is outside the supported range for the target.",
  evaluate(ctx, target) {
    const constraints = target.versionConstraints;
    const javaSet = new Set<number>(constraints.flatMap((c) => Array.from(c.supportedJava)));
    if (!javaSet.has(ctx.javaVersion)) {
      const allowed = Array.from(javaSet).sort((a, b) => a - b).join(", ");
      return [
        ok({
          level: "error",
          code: "JAVA_VERSION_OUT_OF_RANGE",
          messageZh: `目标 ${target.displayName} 支持的 Java 版本：${allowed}，当前选择 Java ${ctx.javaVersion}。`,
          messageEn: `Target ${target.displayName} supports Java ${allowed}, but Java ${ctx.javaVersion} was selected.`,
          fixSuggestionZh: `请选择 Java ${allowed} 中的版本。`,
          fixSuggestionEn: `Choose one of Java ${allowed}.`,
          blocking: true
        })
      ];
    }
    return [];
  }
};

export const RULE_MC_JAVA_MISMATCH: CompatibilityRule = {
  id: "MINECRAFT_JAVA_MISMATCH",
  descriptionZh: "所选 Java 版本与 Minecraft 版本推荐不符。",
  descriptionEn: "Java version is not recommended for the chosen Minecraft version.",
  evaluate(ctx) {
    const mc = getMinecraftVersion(ctx.minecraftVersion);
    if (!mc) {
      return [
        ok({
          level: "info",
          code: "MINECRAFT_VERSION_UNKNOWN",
          messageZh: `未知的 Minecraft 版本 ${ctx.minecraftVersion}，将跳过 Java/Gradle 推荐校验。`,
          messageEn: `Unknown Minecraft version ${ctx.minecraftVersion}; Java/Gradle recommendation checks skipped.`,
          blocking: false
        })
      ];
    }
    if (!mc.supportedJavaVersions.includes(ctx.javaVersion as 8 | 11 | 17 | 21)) {
      const allowed = mc.supportedJavaVersions.join(", ");
      return [
        ok({
          level: "error",
          code: "MINECRAFT_JAVA_MISMATCH",
          messageZh: `Minecraft ${ctx.minecraftVersion} 支持 Java ${allowed}，当前选择 Java ${ctx.javaVersion}。`,
          messageEn: `Minecraft ${ctx.minecraftVersion} supports Java ${allowed}; Java ${ctx.javaVersion} selected.`,
          fixSuggestionZh: `请选择推荐的 Java ${mc.recommendedJavaVersion}。`,
          fixSuggestionEn: `Select recommended Java ${mc.recommendedJavaVersion}.`,
          blocking: true
        })
      ];
    }
    if (mc.recommendedJavaVersion !== ctx.javaVersion) {
      return [
        ok({
          level: "info",
          code: "MINECRAFT_JAVA_PREFER_RECOMMENDED",
          messageZh: `Minecraft ${ctx.minecraftVersion} 推荐使用 Java ${mc.recommendedJavaVersion}。`,
          messageEn: `Minecraft ${ctx.minecraftVersion} prefers Java ${mc.recommendedJavaVersion}.`,
          blocking: false
        })
      ];
    }
    return [];
  }
};

export const RULE_LEGACY_MC: CompatibilityRule = {
  id: "MINECRAFT_VERSION_LEGACY",
  descriptionZh: "所选 Minecraft 版本属于遗留版本，工具链可能不再受官方支持。",
  descriptionEn: "Selected Minecraft version is legacy and may lack official toolchain support.",
  evaluate(ctx) {
    const mc = getMinecraftVersion(ctx.minecraftVersion);
    if (mc?.legacy) {
      return [
        ok({
          level: "warning",
          code: "MINECRAFT_VERSION_LEGACY",
          messageZh: `Minecraft ${ctx.minecraftVersion} 已属于遗留版本（${mc.notesZh || "不再推荐用于生产"}）。`,
          messageEn: `Minecraft ${ctx.minecraftVersion} is legacy (${mc.notesEn || "no longer recommended for production"}).`,
          blocking: false
        })
      ];
    }
    return [];
  }
};

export const RULE_GRADLE_VERSION: CompatibilityRule = {
  id: "GRADLE_VERSION_OUT_OF_RANGE",
  descriptionZh: "所选 Gradle 版本不在 Minecraft 版本推荐范围内。",
  descriptionEn: "Selected Gradle version is not recommended for the Minecraft version.",
  evaluate(ctx) {
    if (!ctx.gradleVersion) return [];
    const mc = getMinecraftVersion(ctx.minecraftVersion);
    if (!mc) return [];
    if (!mc.supportedGradleVersions.includes(ctx.gradleVersion)) {
      return [
        ok({
          level: "warning",
          code: "GRADLE_VERSION_OUT_OF_RANGE",
          messageZh: `Gradle ${ctx.gradleVersion} 不在 MC ${ctx.minecraftVersion} 的推荐列表 ${mc.supportedGradleVersions.join(", ")}。`,
          messageEn: `Gradle ${ctx.gradleVersion} is outside MC ${ctx.minecraftVersion} recommended set ${mc.supportedGradleVersions.join(", ")}.`,
          blocking: false
        })
      ];
    }
    return [];
  }
};

export const builtinRules: ReadonlyArray<CompatibilityRule> = [
  RULE_VELOCITY_NOT_BUKKIT,
  RULE_FOLIA_SCHEDULER,
  RULE_NMS_VERSION_LOCK,
  RULE_JAVA_VERSION_RANGE,
  RULE_MC_JAVA_MISMATCH,
  RULE_LEGACY_MC,
  RULE_GRADLE_VERSION
];
