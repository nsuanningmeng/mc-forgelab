import { KB_SEED } from "./seed.js";
export { STAGE7_MIGRATIONS } from "./migrations.js";
export { KB_SEED } from "./seed.js";

export interface KnowledgeEntry {
  readonly id: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly targetId?: string;
  readonly mcMajor?: string;
  readonly topic?: string;
  readonly title?: string;
  readonly priority?: number;
  readonly updatedAt?: string;
}

export interface KnowledgeSearchOptions {
  readonly targetId?: string;
  readonly mcMajor?: string;
  readonly topic?: string;
  readonly q?: string;
}

interface StorageLike {
  readonly backend: {
    get<T = Record<string, unknown>>(sql: string, params?: ReadonlyArray<string | number | null>): T | undefined;
    run(sql: string, params?: ReadonlyArray<string | number | null>): { changes: number; lastInsertRowid: number };
  };
}

/** Built-in Minecraft development knowledge entries */
const ENTRIES: KnowledgeEntry[] = [
  { id: "paper-main-class", tags: ["paper","plugin","main","class"], content: "Paper plugins must extend JavaPlugin and declare main class in plugin.yml", priority: 50 },
  { id: "paper-plugin-yml", tags: ["paper","plugin.yml","config"], content: "plugin.yml requires: name, version, main, api-version fields", priority: 50 },
  { id: "paper-folia", tags: ["folia","scheduler","thread"], content: "Folia plugins must NOT use BukkitScheduler; use RegionScheduler or GlobalRegionScheduler instead", priority: 20 },
  { id: "paper-adventure", tags: ["paper","adventure","component","text"], content: "Paper 1.16+ uses Adventure API for text components; avoid legacy ChatColor", priority: 40 },
  { id: "fabric-mod-json", tags: ["fabric","fabric.mod.json","metadata"], content: "Fabric mods require fabric.mod.json with id, version, entrypoints fields", priority: 50 },
  { id: "fabric-entrypoint", tags: ["fabric","entrypoint","ModInitializer"], content: "Fabric server entrypoint implements ModInitializer; client entrypoint implements ClientModInitializer", priority: 50 },
  { id: "fabric-loom", tags: ["fabric","loom","gradle","build"], content: "Fabric mods use fabric-loom Gradle plugin; dependency: fabricApi and minecraft mappings", priority: 50 },
  { id: "fabric-mixin", tags: ["fabric","mixin","inject"], content: "Fabric Mixins require @Mixin annotation and must be declared in fabric.mod.json mixins array", priority: 50 },
  { id: "forge-mods-toml", tags: ["forge","mods.toml","metadata"], content: "Forge mods require META-INF/mods.toml with modId, version, displayName", priority: 50 },
  { id: "forge-event-bus", tags: ["forge","event","bus","@Mod.EventBusSubscriber"], content: "Forge events use @SubscribeEvent on methods registered to MinecraftForge.EVENT_BUS or MOD_BUS", priority: 50 },
  { id: "neoforge-moddevgradle", tags: ["neoforge","moddevgradle","gradle"], content: "NeoForge uses net.neoforged.moddev Gradle plugin instead of ForgeGradle", priority: 30 },
  { id: "velocity-plugin-json", tags: ["velocity","velocity-plugin.json","proxy"], content: "Velocity plugins require @Plugin annotation with id, name, version; no plugin.yml", priority: 50 },
  { id: "velocity-event", tags: ["velocity","event","Subscribe"], content: "Velocity events use @Subscribe annotation; register with EventManager.register()", priority: 50 },
  { id: "java-version-mc", tags: ["java","version","minecraft","compatibility"], content: "MC 1.8-1.16: Java 8; MC 1.17: Java 16; MC 1.18-1.20: Java 17; MC 1.21+: Java 21", priority: 20 },
  { id: "gradle-kotlin-dsl", tags: ["gradle","kotlin","dsl","build.gradle.kts"], content: "Prefer Gradle Kotlin DSL (build.gradle.kts) for type-safe build scripts", priority: 60 }
];

const ALL_ENTRIES: readonly KnowledgeEntry[] = [...KB_SEED, ...ENTRIES];

/** Keyword-based search returns entries matching any keyword (case-insensitive) */
export function queryKnowledge(keywords: string[]): KnowledgeEntry[] {
  const lower = keywords.map((k) => k.toLowerCase());
  return ALL_ENTRIES.filter((e) => lower.some((k) => e.tags.some((t) => t.includes(k) || k.includes(t))));
}

function normalizeMajor(version?: string): string | undefined {
  if (!version) return undefined;
  const parts = version.split(".");
  if (parts.length < 2) return version;
  return `${parts[0]}.${parts[1]}`;
}

function matchesEntry(entry: KnowledgeEntry, opts: KnowledgeSearchOptions): boolean {
  const targetId = opts.targetId?.toLowerCase();
  const mcMajor = normalizeMajor(opts.mcMajor)?.toLowerCase();
  const topic = opts.topic?.toLowerCase();
  const q = opts.q?.trim().toLowerCase();

  if (targetId && entry.targetId && entry.targetId !== "" && entry.targetId.toLowerCase() !== targetId) return false;
  if (mcMajor && entry.mcMajor && entry.mcMajor !== "" && entry.mcMajor.toLowerCase() !== mcMajor) return false;
  if (topic && entry.topic && entry.topic.toLowerCase() !== topic) return false;

  if (!q) return true;
  const haystack = [
    entry.id,
    entry.title ?? "",
    entry.content,
    entry.targetId ?? "",
    entry.mcMajor ?? "",
    entry.topic ?? "",
    ...entry.tags
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function scoreEntry(entry: KnowledgeEntry, opts: KnowledgeSearchOptions): number {
  let score = 1000 - (entry.priority ?? 100);
  const targetId = opts.targetId?.toLowerCase();
  const mcMajor = normalizeMajor(opts.mcMajor)?.toLowerCase();
  const topic = opts.topic?.toLowerCase();
  const q = opts.q?.trim().toLowerCase();

  if (targetId && entry.targetId?.toLowerCase() === targetId) score += 100;
  if (mcMajor && entry.mcMajor?.toLowerCase() === mcMajor) score += 80;
  if (topic && entry.topic?.toLowerCase() === topic) score += 60;
  if (q && entry.title?.toLowerCase().includes(q)) score += 40;
  if (q && entry.tags.some((tag) => tag.toLowerCase().includes(q))) score += 20;
  return score;
}

export function search(opts: KnowledgeSearchOptions): KnowledgeEntry[] {
  return ALL_ENTRIES
    .filter((entry) => matchesEntry(entry, opts))
    .sort((a, b) => scoreEntry(b, opts) - scoreEntry(a, opts) || a.id.localeCompare(b.id));
}

export function getKnowledgeMatrix() {
  const targets = Array.from(new Set(KB_SEED.map((e) => e.targetId ?? "").filter((v) => v.length > 0))).sort();
  const mcMajors = Array.from(new Set(KB_SEED.map((e) => e.mcMajor ?? "").filter((v) => v.length > 0))).sort();
  const topics = Array.from(new Set(KB_SEED.map((e) => e.topic ?? "").filter((v) => v.length > 0))).sort();
  return { targets, mcMajors, topics };
}

export function applyMigration(storage: StorageLike): void {
  const row = storage.backend.get<{ count: number }>("SELECT COUNT(*) AS count FROM knowledge_entries");
  if ((row?.count ?? 0) > 0) return;

  for (const entry of KB_SEED) {
    storage.backend.run(
      "INSERT INTO knowledge_entries (id, target_id, mc_major, topic, title, content, tags_json, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        entry.id,
        entry.targetId ?? "",
        entry.mcMajor ?? "",
        entry.topic ?? "",
        entry.title ?? entry.id,
        entry.content,
        JSON.stringify(entry.tags),
        entry.priority ?? 100,
        entry.updatedAt ?? new Date().toISOString()
      ]
    );
  }
}

/** Format entries for injection into AI prompt context */
export function formatKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return "";
  return "## Minecraft Development Knowledge\n" + entries.map((e) => `- ${e.content}`).join("\n");
}
