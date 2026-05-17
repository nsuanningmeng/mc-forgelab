export interface KnowledgeEntry {
  readonly id: string;
  readonly tags: readonly string[];
  readonly content: string;
}

/** Built-in Minecraft development knowledge entries */
const ENTRIES: KnowledgeEntry[] = [
  { id: "paper-main-class", tags: ["paper","plugin","main","class"], content: "Paper plugins must extend JavaPlugin and declare main class in plugin.yml" },
  { id: "paper-plugin-yml", tags: ["paper","plugin.yml","config"], content: "plugin.yml requires: name, version, main, api-version fields" },
  { id: "paper-folia", tags: ["folia","scheduler","thread"], content: "Folia plugins must NOT use BukkitScheduler; use RegionScheduler or GlobalRegionScheduler instead" },
  { id: "paper-adventure", tags: ["paper","adventure","component","text"], content: "Paper 1.16+ uses Adventure API for text components; avoid legacy ChatColor" },
  { id: "fabric-mod-json", tags: ["fabric","fabric.mod.json","metadata"], content: "Fabric mods require fabric.mod.json with id, version, entrypoints fields" },
  { id: "fabric-entrypoint", tags: ["fabric","entrypoint","ModInitializer"], content: "Fabric server entrypoint implements ModInitializer; client entrypoint implements ClientModInitializer" },
  { id: "fabric-loom", tags: ["fabric","loom","gradle","build"], content: "Fabric mods use fabric-loom Gradle plugin; dependency: fabricApi and minecraft mappings" },
  { id: "fabric-mixin", tags: ["fabric","mixin","inject"], content: "Fabric Mixins require @Mixin annotation and must be declared in fabric.mod.json mixins array" },
  { id: "forge-mods-toml", tags: ["forge","mods.toml","metadata"], content: "Forge mods require META-INF/mods.toml with modId, version, displayName" },
  { id: "forge-event-bus", tags: ["forge","event","bus","@Mod.EventBusSubscriber"], content: "Forge events use @SubscribeEvent on methods registered to MinecraftForge.EVENT_BUS or MOD_BUS" },
  { id: "neoforge-moddevgradle", tags: ["neoforge","moddevgradle","gradle"], content: "NeoForge uses net.neoforged.moddev Gradle plugin instead of ForgeGradle" },
  { id: "velocity-plugin-json", tags: ["velocity","velocity-plugin.json","proxy"], content: "Velocity plugins require @Plugin annotation with id, name, version; no plugin.yml" },
  { id: "velocity-event", tags: ["velocity","event","Subscribe"], content: "Velocity events use @Subscribe annotation; register with EventManager.register()" },
  { id: "java-version-mc", tags: ["java","version","minecraft","compatibility"], content: "MC 1.8-1.16: Java 8; MC 1.17: Java 16; MC 1.18-1.20: Java 17; MC 1.21+: Java 21" },
  { id: "gradle-kotlin-dsl", tags: ["gradle","kotlin","dsl","build.gradle.kts"], content: "Prefer Gradle Kotlin DSL (build.gradle.kts) for type-safe build scripts" },
];

/** Keyword-based search — returns entries matching any keyword (case-insensitive) */
export function queryKnowledge(keywords: string[]): KnowledgeEntry[] {
  const lower = keywords.map((k) => k.toLowerCase());
  return ENTRIES.filter((e) => lower.some((k) => e.tags.some((t) => t.includes(k) || k.includes(t))));
}

/** Format entries for injection into AI prompt context */
export function formatKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return "";
  return "## Minecraft Development Knowledge\n" + entries.map((e) => `- ${e.content}`).join("\n");
}
