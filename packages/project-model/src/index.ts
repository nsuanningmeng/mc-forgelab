/**
 * @mc-forgelab/project-model — 阶段 2 实施
 *
 * 当前文件仅提供接口契约 stub，后续阶段实现：
 * - ProjectSpec / ProjectModuleSpec
 * - validateProjectSpec(spec)
 * - normalizeProjectSpec(spec)
 * - serializeProjectSpec(spec) → JSON 适配 schemas/project.schema.json
 */

export type ProjectType = "plugin" | "mod" | "proxy" | "hybrid";

export interface ProjectModuleSpec {
  readonly id: string;
  readonly type: "plugin" | "mod" | "proxy-plugin" | "shared-lib";
  readonly sourceSet: "main" | "client" | "server" | "common";
  readonly entrypoints: Readonly<Record<string, string>>;
}

export interface ProjectFeatures {
  readonly enableCommand?: boolean;
  readonly enableListener?: boolean;
  readonly enableConfig?: boolean;
  readonly enablePermissions?: boolean;
  readonly enableDatabase?: boolean;
  readonly enablePlaceholderAPI?: boolean;
  readonly enableLuckPerms?: boolean;
  readonly enableVault?: boolean;
  readonly enableProtocolLib?: boolean;
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
  readonly modules?: ReadonlyArray<ProjectModuleSpec>;
}

/** STAGE 2: throws on invalid spec */
export function validateProjectSpec(_spec: ProjectSpec): void {
  throw new Error("project-model.validateProjectSpec: not implemented (stage 2)");
}

/** STAGE 2: returns normalized spec (defaults filled in) */
export function normalizeProjectSpec(spec: ProjectSpec): ProjectSpec {
  throw new Error(`project-model.normalizeProjectSpec: not implemented (stage 2). got ${spec.slug}`);
}
