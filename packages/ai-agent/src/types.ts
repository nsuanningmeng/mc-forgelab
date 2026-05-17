export type TaskType = "create" | "modify" | "fix" | "explain" | "refactor" | "generate-docs";
export type ProjectType = "plugin" | "mod" | "hybrid" | "proxy";

export interface RequirementSpec {
  readonly taskType: TaskType;
  readonly projectType: ProjectType;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly features: readonly string[];
  readonly needsDatabase: boolean;
  readonly needsPermissions: boolean;
  readonly needsThirdPartyApis: readonly string[];
  readonly needsClientSide: boolean;
  readonly needsHybrid: boolean;
  readonly rawPrompt: string;
}

export interface ProjectPlan {
  readonly projectName: string;
  readonly packageName: string;
  readonly mainClass: string;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildTool: "gradle-kotlin" | "gradle-groovy" | "maven";
  readonly filesToGenerate: readonly string[];
  readonly commands: readonly string[];
  readonly listeners: readonly string[];
  readonly configKeys: readonly string[];
  readonly permissions: readonly string[];
  readonly storageType: "none" | "yaml" | "sqlite" | "mysql";
  readonly thirdPartyDeps: readonly string[];
  readonly compatibilityWarnings: readonly string[];
  readonly description: string;
}
