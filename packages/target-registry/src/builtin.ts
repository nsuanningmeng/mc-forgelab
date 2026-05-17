import type { Target, TargetCapabilities } from "./target.js";

const baseCaps: TargetCapabilities = {
  supportsPlugins: false,
  supportsMods: false,
  supportsProxy: false,
  supportsPaperApi: false,
  supportsBukkitApi: false,
  supportsSpigotApi: false,
  supportsForge: false,
  supportsNeoForge: false,
  supportsFabric: false,
  supportsQuilt: false,
  supportsMixin: false,
  supportsNms: false,
  supportsAdventure: false,
  supportsVelocity: false,
  supportsBungee: false,
  supportsFoliaScheduler: false,
  supportsHybridRuntime: false
};

function withCaps(overrides: Partial<TargetCapabilities>): TargetCapabilities {
  return { ...baseCaps, ...overrides };
}

/**
 * 阶段 1 内置 3 个稳定目标作为参考实现：Paper、Fabric、Velocity。
 * 其余目标 (Bukkit/Spigot/Purpur/Folia/Forge/NeoForge/Quilt/Hybrid) 在阶段 9 通过 JSON loader 注入。
 *
 * **不承诺所有 MC 版本均稳定支持**：每个目标只列已验证或推荐的 MC 主线版本。
 */
export const builtinTargets: ReadonlyArray<Target> = [
  {
    id: "paper",
    displayName: "Paper",
    type: "plugin",
    stability: "stable",
    recommendedBuildTool: "gradle",
    versionConstraints: [
      {
        minecraftRange: ">=1.20.1 <=1.21.4",
        recommendedJava: 21,
        supportedJava: [17, 21],
        recommendedGradle: "8.10",
        supportedGradle: ["8.7", "8.8", "8.10"]
      }
    ],
    templateIds: ["plugin-paper-java"],
    docsUrl: "https://docs.papermc.io/",
    warningsZh: ["使用 NMS 会强绑定 Minecraft 小版本，升级时需要重新构建。"],
    warningsEn: ["Using NMS will tightly couple the plugin to a specific minor Minecraft version."],
    experimental: false,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsPlugins: true,
      supportsBukkitApi: true,
      supportsSpigotApi: true,
      supportsPaperApi: true,
      supportsAdventure: true,
      supportsNms: true
    })
  },
  {
    id: "fabric",
    displayName: "Fabric",
    type: "mod",
    stability: "stable",
    recommendedBuildTool: "gradle",
    versionConstraints: [
      {
        minecraftRange: ">=1.20.1 <=1.21.4",
        recommendedJava: 21,
        supportedJava: [17, 21],
        recommendedGradle: "8.10",
        supportedGradle: ["8.7", "8.8", "8.10"]
      }
    ],
    templateIds: ["mod-fabric-java"],
    docsUrl: "https://fabricmc.net/wiki/start",
    warningsZh: ["Fabric 模组同时部署到客户端/服务端时需要分别声明环境。"],
    warningsEn: ["Fabric mods must declare client/server environment for each entrypoint."],
    experimental: false,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsMods: true,
      supportsFabric: true,
      supportsMixin: true,
      supportsAdventure: false
    })
  },
  {
    id: "velocity",
    displayName: "Velocity",
    type: "proxy",
    stability: "stable",
    recommendedBuildTool: "gradle",
    versionConstraints: [
      {
        minecraftRange: ">=1.20.1 <=1.21.4",
        recommendedJava: 21,
        supportedJava: [17, 21],
        recommendedGradle: "8.10"
      }
    ],
    templateIds: ["plugin-velocity-java"],
    docsUrl: "https://docs.papermc.io/velocity",
    warningsZh: ["Velocity 不是 Bukkit 派生，禁止将其作为 Paper/Spigot 插件运行。"],
    warningsEn: ["Velocity is not a Bukkit fork; do not deploy Velocity plugins on Paper/Spigot."],
    experimental: false,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsProxy: true,
      supportsVelocity: true,
      supportsAdventure: true
    })
  }
];
