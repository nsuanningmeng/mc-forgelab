export { detectGradleJavaVersion } from "./java-version.js";
export type { JavaVersionDetection, SupportedJavaVersion } from "./java-version.js";

export type ProjectType = "plugin" | "mod" | "proxy" | "hybrid";

export interface ProjectFeatures {
  readonly enableCommand?: boolean;
  readonly enableListener?: boolean;
  readonly enableConfig?: boolean;
  readonly enablePermissions?: boolean;
  readonly enableDatabase?: boolean;
  readonly enablePlaceholderAPI?: boolean;
  readonly enableLuckPerms?: boolean;
  readonly enableVault?: boolean;
  readonly enableAdventure?: boolean;
  readonly enableMixin?: boolean;
  readonly enableFoliaSupport?: boolean;
}

export interface ProjectSpec {
  readonly id?: string;
  readonly name: string;
  readonly slug: string;
  readonly type: ProjectType;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildTool: "gradle" | "maven";
  readonly packageName: string;
  readonly mainClass?: string;
  readonly author?: string;
  readonly description?: string;
  readonly version: string;
  readonly features?: ProjectFeatures;
}

export function validateProjectSpec(spec: ProjectSpec): void {
  if (!spec.name || !spec.slug || !spec.packageName) throw new Error("ProjectSpec missing required fields");
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(spec.packageName)) throw new Error(`Invalid packageName: ${spec.packageName}`);
}

export function normalizeProjectSpec(spec: ProjectSpec): ProjectSpec {
  const slug = spec.slug || spec.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const mainClass = spec.mainClass ?? `${spec.packageName}.${toPascalCase(spec.name)}`;
  return { ...spec, slug, mainClass, version: spec.version || "1.0.0", author: spec.author || "unknown" };
}

function toPascalCase(s: string): string {
  return s.replace(/(?:^|[-_\s])(\w)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
}
