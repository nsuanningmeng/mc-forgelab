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
  },
  // ── plugin 组 ──────────────────────────────────────────────────────────────
  {
    id: "spigot",
    displayName: "Spigot",
    type: "plugin",
    stability: "legacy",
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
    templateIds: ["plugin-spigot-java"],
    docsUrl: "https://www.spigotmc.org/wiki/spigot/",
    warningsZh: ["Spigot 已进入维护模式，新项目建议迁移至 Paper 或 Purpur。"],
    warningsEn: ["Spigot is in maintenance mode; new projects should migrate to Paper or Purpur."],
    experimental: false,
    legacy: true,
    deprecated: false,
    capabilities: withCaps({
      supportsPlugins: true,
      supportsBukkitApi: true,
      supportsSpigotApi: true,
      supportsAdventure: true
    })
  },
  {
    id: "bukkit",
    displayName: "Bukkit",
    type: "plugin",
    stability: "legacy",
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
    templateIds: ["plugin-bukkit-java"],
    docsUrl: "https://bukkit.fandom.com/wiki/Plugin_Tutorial",
    warningsZh: ["Bukkit API 已冻结，仅保留最低限度兼容层，强烈建议迁移至 Paper。"],
    warningsEn: ["Bukkit API is frozen; migrate to Paper for active development."],
    experimental: false,
    legacy: true,
    deprecated: false,
    capabilities: withCaps({
      supportsPlugins: true,
      supportsBukkitApi: true
    })
  },
  {
    id: "purpur",
    displayName: "Purpur",
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
    templateIds: ["plugin-purpur-java"],
    docsUrl: "https://purpurmc.org/docs/",
    warningsZh: ["Purpur 扩展了 Paper API，部分 API 不向下兼容 Paper。"],
    warningsEn: ["Purpur extends Paper API; some APIs are not back-compatible with vanilla Paper."],
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
    id: "folia",
    displayName: "Folia",
    type: "plugin",
    stability: "experimental",
    recommendedBuildTool: "gradle",
    versionConstraints: [
      {
        minecraftRange: ">=1.20.1 <=1.21.4",
        recommendedJava: 21,
        supportedJava: [21],
        recommendedGradle: "8.10",
        supportedGradle: ["8.7", "8.8", "8.10"]
      }
    ],
    templateIds: ["plugin-folia-java"],
    docsUrl: "https://docs.papermc.io/folia",
    warningsZh: ["Folia 使用区域化线程调度，大量同步 Bukkit API 不可用，需专门适配。"],
    warningsEn: ["Folia uses regionized threading; many synchronous Bukkit APIs are unavailable and require explicit porting."],
    experimental: true,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsPlugins: true,
      supportsBukkitApi: true,
      supportsSpigotApi: true,
      supportsPaperApi: true,
      supportsAdventure: true,
      supportsFoliaScheduler: true
    })
  },
  // ── mod 组 ─────────────────────────────────────────────────────────────────
  {
    id: "forge",
    displayName: "Forge",
    type: "mod",
    stability: "experimental",
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
    templateIds: ["mod-forge-java"],
    docsUrl: "https://docs.minecraftforge.net/",
    warningsZh: ["Forge 构建工具链复杂，每次 MC 大版本升级均需等待官方适配。"],
    warningsEn: ["Forge toolchain is complex; each major MC version requires waiting for official porting."],
    experimental: true,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsMods: true,
      supportsForge: true,
      supportsMixin: true
    })
  },
  {
    id: "neoforge",
    displayName: "NeoForge",
    type: "mod",
    stability: "experimental",
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
    templateIds: ["mod-neoforge-java"],
    docsUrl: "https://docs.neoforged.net/",
    warningsZh: ["NeoForge 是 Forge 的社区分支，API 仍在快速演进，注意版本锁定。"],
    warningsEn: ["NeoForge is a community fork of Forge; API is still evolving rapidly — pin versions carefully."],
    experimental: true,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsMods: true,
      supportsNeoForge: true,
      supportsMixin: true
    })
  },
  {
    id: "quilt",
    displayName: "Quilt",
    type: "mod",
    stability: "experimental",
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
    templateIds: ["mod-quilt-java"],
    docsUrl: "https://quiltmc.org/en/usage/getting-started/",
    warningsZh: ["Quilt 兼容大多数 Fabric 模组，但部分 Fabric API 扩展行为存在差异。"],
    warningsEn: ["Quilt is compatible with most Fabric mods, but some Fabric API extension behaviors may differ."],
    experimental: true,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsMods: true,
      supportsQuilt: true,
      supportsFabric: true,
      supportsMixin: true
    })
  },
  // ── proxy 组 ───────────────────────────────────────────────────────────────
  {
    id: "bungeecord",
    displayName: "BungeeCord",
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
    templateIds: ["plugin-bungeecord-java"],
    docsUrl: "https://www.spigotmc.org/wiki/bungeecord/",
    warningsZh: ["BungeeCord 不支持 Adventure API，消息组件需使用旧版 ChatColor。"],
    warningsEn: ["BungeeCord does not support Adventure API; use legacy ChatColor for message components."],
    experimental: false,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsProxy: true,
      supportsBungee: true
    })
  },
  {
    id: "waterfall",
    displayName: "Waterfall",
    type: "proxy",
    stability: "deprecated",
    recommendedBuildTool: "gradle",
    versionConstraints: [
      {
        minecraftRange: ">=1.20.1 <=1.21.4",
        recommendedJava: 21,
        supportedJava: [17, 21],
        recommendedGradle: "8.10"
      }
    ],
    templateIds: ["plugin-waterfall-java"],
    docsUrl: "https://docs.papermc.io/waterfall",
    warningsZh: ["Waterfall 已于 2024 年 EOL，请迁移至 Velocity。"],
    warningsEn: ["Waterfall reached EOL in 2024; migrate to Velocity."],
    experimental: false,
    legacy: false,
    deprecated: true,
    capabilities: withCaps({
      supportsProxy: true,
      supportsBungee: true
    })
  },
  // ── hybrid 组 ──────────────────────────────────────────────────────────────
  {
    id: "mohist",
    displayName: "Mohist",
    type: "hybrid",
    stability: "experimental",
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
    templateIds: ["hybrid-mohist-java"],
    docsUrl: "https://mohistmc.com/",
    warningsZh: ["混合端兼容性无法保证，插件与模组之间可能存在不可预期的冲突，不建议用于生产环境。"],
    warningsEn: ["Hybrid runtime compatibility is not guaranteed; unexpected conflicts between plugins and mods may occur. Not recommended for production."],
    experimental: true,
    legacy: false,
    deprecated: false,
    capabilities: withCaps({
      supportsPlugins: true,
      supportsMods: true,
      supportsHybridRuntime: true,
      supportsBukkitApi: true,
      supportsSpigotApi: true,
      supportsForge: true
    })
  }
];
