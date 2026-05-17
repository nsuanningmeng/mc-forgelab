import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveInsideBase } from "@mc-forgelab/file-operation";
import type { ProjectSpec } from "@mc-forgelab/project-model";

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

const TEMPLATES: TemplateMeta[] = [
  { id: "plugin-paper-java", version: "1.0.0", displayName: "Paper 插件 (Java)", compatibleTargetIds: ["paper", "spigot", "purpur", "folia"], descriptionZh: "Paper 插件 Gradle Kotlin DSL 模板", descriptionEn: "Paper plugin with Gradle Kotlin DSL" }
];

export function listTemplates(targetId?: string): TemplateMeta[] {
  if (!targetId) return TEMPLATES;
  return TEMPLATES.filter((t) => t.compatibleTargetIds.includes(targetId));
}

export async function renderTemplate(templateId: string, spec: ProjectSpec, outputDir: string, options: RenderOptions = {}): Promise<RenderedFile[]> {
  if (templateId !== "plugin-paper-java") throw new Error(`Unknown template: ${templateId}`);
  const files = renderPaperPlugin(spec);
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
    { relativePath: "settings.gradle.kts", content: `rootProject.name = "${spec.slug}"\n` },
    { relativePath: "gradle/wrapper/gradle-wrapper.properties", content: gradleWrapper(gradleVersion) },
    { relativePath: "src/main/resources/plugin.yml", content: pluginYml(pluginName, mainClass, version, desc, author, f) },
    { relativePath: "src/main/resources/config.yml", content: f.enableConfig ? defaultConfig() : "" },
    { relativePath: `src/main/java/${pkg.replace(/\./g, "/")}/${mainSimple}.java`, content: mainClassJava(pkg, mainSimple, f) },
    { relativePath: "README.md", content: `# ${pluginName}\n\n${desc}\n\n## 安装\n将 jar 放入 plugins/ 目录并重启服务器。\n` }
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
