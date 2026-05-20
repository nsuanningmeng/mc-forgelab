import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveInsideBase } from "@mc-forgelab/file-operation";
import type { ProjectSpec } from "@mc-forgelab/project-model";
import { createDefaultRegistry, type Target } from "@mc-forgelab/target-registry";

export interface TemplateMeta {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly compatibleTargetIds: ReadonlyArray<string>;
  readonly descriptionZh: string;
  readonly descriptionEn: string;
}

export interface RenderedFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface RenderOptions {
  readonly dryRun?: boolean;
  readonly overwrite?: boolean;
}

interface TemplateDefinition extends Omit<TemplateMeta, "compatibleTargetIds"> {
  readonly isCompatibleTarget: (target: Target) => boolean;
}

const TEMPLATES: TemplateDefinition[] = [
  { id: "plugin-paper-java", version: "1.0.0", displayName: "Paper \u63d2\u4ef6 (Java)", isCompatibleTarget: (t) => t.type === "plugin" && (t.capabilities.supportsPaperApi || t.capabilities.supportsSpigotApi || t.capabilities.supportsFoliaScheduler), descriptionZh: "Paper \u63d2\u4ef6 Gradle Kotlin DSL \u6a21\u677f", descriptionEn: "Paper plugin with Gradle Kotlin DSL" },
  { id: "mod-fabric-java", version: "1.0.0", displayName: "Fabric \u6a21\u7ec4 (Java)", isCompatibleTarget: (t) => t.type === "mod" && t.capabilities.supportsFabric && !t.capabilities.supportsQuilt, descriptionZh: "Fabric \u6a21\u7ec4 Loom \u6a21\u677f", descriptionEn: "Fabric mod with Loom" },
  { id: "plugin-velocity-java", version: "1.0.0", displayName: "Velocity \u63d2\u4ef6 (Java)", isCompatibleTarget: (t) => t.type === "proxy" && t.capabilities.supportsVelocity, descriptionZh: "Velocity \u4ee3\u7406\u7aef\u63d2\u4ef6\u6a21\u677f", descriptionEn: "Velocity proxy plugin" },
];

let cachedTemplates: TemplateMeta[] | null = null;

function toTemplateMeta(template: TemplateDefinition, targets: ReadonlyArray<Target>): TemplateMeta {
  const { isCompatibleTarget, ...meta } = template;
  return {
    ...meta,
    compatibleTargetIds: targets
      .filter(isCompatibleTarget)
      .map((target) => target.id),
  };
}

function getTemplateMetas(): TemplateMeta[] {
  if (!cachedTemplates) {
    const targets = createDefaultRegistry().list({ includeLegacy: true, includeDeprecated: true });
    cachedTemplates = TEMPLATES.map((template) => toTemplateMeta(template, targets));
  }
  return cachedTemplates;
}

export function listTemplates(targetId?: string): TemplateMeta[] {
  const templates = getTemplateMetas();
  if (!targetId) return templates.slice();
  return templates.filter((t) => t.compatibleTargetIds.includes(targetId));
}

export async function renderTemplate(templateId: string, spec: ProjectSpec, outputDir: string, options: RenderOptions = {}): Promise<RenderedFile[]> {
  let files: RenderedFile[];
  if (templateId === "plugin-paper-java") files = renderPaperPlugin(spec);
  else if (templateId === "mod-fabric-java") files = renderFabricMod(spec);
  else if (templateId === "plugin-velocity-java") files = renderVelocityPlugin(spec);
  else throw new Error(`Unknown template: ${templateId}`);
  if (!options.dryRun) {
    for (const f of files) {
      const abs = resolveInsideBase(outputDir, f.relativePath);
      if (!options.overwrite && existsSync(abs)) continue;
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.content, "utf8");
    }
  }
  return files;
}

function renderPaperPlugin(spec: ProjectSpec): RenderedFile[] {
  const mc = spec.minecraftVersion;
  const java = spec.javaVersion;
  const pkg = spec.packageName;
  const mainClass = spec.mainClass ?? `${pkg}.${toPascalCase(spec.name)}`;
  const mainSimple = mainClass.split(".").pop()!;
  const pluginName = spec.name;
  const desc = spec.description ?? pluginName;
  const author = spec.author ?? "unknown";
  const version = spec.version ?? "1.0.0";
  const f = spec.features ?? {};

  // Gradle version mapping
  const gradleVersion = java >= 21 ? "8.8" : java >= 17 ? "8.5" : "8.3";
  const paperApiVersion = mc.split(".").slice(0, 2).join(".");

  return [
    { relativePath: "build.gradle.kts", content: buildGradle(pkg, mc, java, paperApiVersion) },
    { relativePath: "settings.gradle.kts", content: `rootProject.name = "${escKotlin(spec.slug ?? spec.name)}"\n` },
    { relativePath: "gradle/wrapper/gradle-wrapper.properties", content: gradleWrapper(gradleVersion) },
    { relativePath: "src/main/resources/plugin.yml", content: pluginYml(pluginName, mainClass, version, desc, author, f) },
    { relativePath: "src/main/resources/config.yml", content: f.enableConfig ? defaultConfig() : "" },
    { relativePath: `src/main/java/${pkg.replace(/\./g, "/")}/${mainSimple}.java`, content: mainClassJava(pkg, mainSimple, f) },
    { relativePath: "README.md", content: `# ${pluginName}\n\n${desc}\n\n## 安装\n�?jar 放入 plugins/ 目录并重启服务器。\n` }
  ].filter((f) => f.content !== "");
}

function buildGradle(pkg: string, mc: string, java: number, paperApi: string): string {
  return `plugins {
    java
    id("io.papermc.paperweight.userdev") version "1.7.1"
}

group = "${pkg}"
version = "1.0.0"

java { toolchain.languageVersion.set(JavaLanguageVersion.of(${java})) }

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    paperweight.paperDevBundle("${mc}-R0.1-SNAPSHOT")
}

tasks.reobfJar { outputJar.set(layout.buildDirectory.file("libs/\${project.name}-\${project.version}.jar")) }
`;
}

function gradleWrapper(version: string): string {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
}

function pluginYml(name: string, main: string, version: string, desc: string, author: string, f: NonNullable<import("@mc-forgelab/project-model").ProjectSpec["features"]>): string {
  const lines = [`name: ${name}`, `version: '${version}'`, `main: ${main}`, `api-version: '1.20'`, `description: ${desc}`, `author: ${author}`];
  if (f.enableCommand) lines.push("commands:\n  example:\n    description: Example command\n    usage: /<command>");
  if (f.enablePermissions) lines.push("permissions:\n  example.use:\n    description: Use example\n    default: op");
  return lines.join("\n") + "\n";
}

function defaultConfig(): string {
  return "# Plugin configuration\nmessages:\n  prefix: '&a[Plugin]&r '\n";
}

function mainClassJava(pkg: string, cls: string, f: NonNullable<import("@mc-forgelab/project-model").ProjectSpec["features"]>): string {
  const imports = ["import org.bukkit.plugin.java.JavaPlugin;"];
  if (f.enableListener) imports.push("import org.bukkit.event.Listener;", "import org.bukkit.event.EventHandler;", "import org.bukkit.event.player.PlayerJoinEvent;");
  const listenerImpl = f.enableListener ? ` implements Listener` : "";
  const listenerBody = f.enableListener ? `\n    @EventHandler\n    public void onJoin(PlayerJoinEvent e) { /* TODO */ }\n` : "";
  const cmdBody = f.enableCommand ? `\n    @Override\n    public boolean onCommand(org.bukkit.command.CommandSender s, org.bukkit.command.Command c, String l, String[] a) { return true; }\n` : "";
  return `package ${pkg};

${imports.join("\n")}

public class ${cls} extends JavaPlugin${listenerImpl} {
    @Override
    public void onEnable() {
        getLogger().info("${cls} enabled!");${f.enableConfig ? "\n        saveDefaultConfig();" : ""}${f.enableListener ? "\n        getServer().getPluginManager().registerEvents(this, this);" : ""}
    }

    @Override
    public void onDisable() { getLogger().info("${cls} disabled!"); }
${listenerBody}${cmdBody}}
`;
}

function toPascalCase(s: string): string {
  return s.replace(/(?:^|[-_\s])(\w)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
}

/** Escape a string for safe embedding in Kotlin/Groovy string literals */
function escKotlin(s: string): string { return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$"); }
/** Escape a string for safe embedding in YAML scalar values */
function escYaml(s: string): string { return s.replace(/['"\\:\n\r]/g, (c) => `\\${c}`); }
/** Strip non-identifier chars for Java package/class names */
function safeId(s: string): string { return s.replace(/[^a-zA-Z0-9._-]/g, "_"); }

function renderFabricMod(spec: ProjectSpec): RenderedFile[] {
  const pkg = spec.packageName;
  const cls = toPascalCase(spec.name);
  const modId = spec.slug ?? spec.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const mc = spec.minecraftVersion;
  const java = spec.javaVersion;
  return [
    { relativePath: "build.gradle.kts", content: `plugins { java; id("fabric-loom") version "1.7.+" }\ngroup = "${pkg}"\nversion = "1.0.0"\njava { toolchain.languageVersion.set(JavaLanguageVersion.of(${java})) }\ndependencies {\n  minecraft("com.mojang:minecraft:${mc}")\n  mappings(loom.officialMojangMappings())\n  modImplementation("net.fabricmc:fabric-loader:0.16.+")\n  modImplementation("net.fabricmc.fabric-api:fabric-api:0.+")\n}\n` },
    { relativePath: "src/main/resources/fabric.mod.json", content: JSON.stringify({ schemaVersion: 1, id: modId, version: "1.0.0", name: spec.name, description: spec.description ?? "", authors: [spec.author ?? "unknown"], entrypoints: { main: [`${pkg}.${cls}`] }, depends: { fabricloader: ">=0.16", minecraft: `~${mc}` } }, null, 2) },
    { relativePath: `src/main/java/${pkg.replace(/\./g, "/")}/${cls}.java`, content: `package ${pkg};\nimport net.fabricmc.api.ModInitializer;\npublic class ${cls} implements ModInitializer {\n  @Override public void onInitialize() {}\n}\n` },
  ];
}

function renderVelocityPlugin(spec: ProjectSpec): RenderedFile[] {
  const pkg = spec.packageName;
  const cls = toPascalCase(spec.name);
  const id = spec.slug ?? spec.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const java = spec.javaVersion;
  return [
    { relativePath: "build.gradle.kts", content: `plugins { java }\ngroup = "${pkg}"\nversion = "1.0.0"\njava { toolchain.languageVersion.set(JavaLanguageVersion.of(${java})) }\nrepositories { maven("https://repo.papermc.io/repository/maven-public/") }\ndependencies { compileOnly("com.velocitypowered:velocity-api:3.3.0-SNAPSHOT") }\n` },
    { relativePath: `src/main/java/${pkg.replace(/\./g, "/")}/${cls}.java`, content: `package ${pkg};\nimport com.google.inject.Inject;\nimport com.velocitypowered.api.plugin.Plugin;\nimport com.velocitypowered.api.proxy.ProxyServer;\n@Plugin(id = "${id}", name = "${spec.name}", version = "1.0.0")\npublic class ${cls} {\n  @Inject public ${cls}(ProxyServer server) {}\n}\n` },
  ];
}
