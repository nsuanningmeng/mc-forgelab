export type TaskType = "create" | "modify" | "fix" | "explain" | "refactor" | "generate-docs";
export type ProjectType = "plugin" | "mod" | "hybrid" | "proxy";
export type BuildErrorSeverity = "error" | "warning" | "info";

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

export interface BuildErrorLocation {
  readonly filePath: string | null;
  readonly line: number | null;
  readonly column: number | null;
}

export interface BuildErrorFinding {
  readonly message: string;
  readonly type: string;
  readonly severity: BuildErrorSeverity;
  readonly location: BuildErrorLocation;
  readonly rawLine: string;
}

export interface ErrorAnalysis {
  readonly summary: string;
  readonly compressedLog: string;
  readonly findings: readonly BuildErrorFinding[];
  readonly likelyCause: string | null;
  readonly suggestedFocusFiles: readonly string[];
  readonly truncated: boolean;
}

export interface AutoFixAttempt {
  readonly round: number;
  readonly summary: string;
  readonly patch: import("@mc-forgelab/file-operation").FilePatch | null;
  readonly buildStatus: "success" | "failed";
  readonly errorSummary: string | null;
}

export interface AutoFixContext {
  readonly projectId: string;
  readonly workspaceRoot: string;
  readonly projectPath: string;
  readonly round: number;
  readonly maxRounds: number;
  readonly errorAnalysis: ErrorAnalysis;
  readonly relevantFiles: Readonly<Record<string, string>>;
  readonly previousAttempts: readonly AutoFixAttempt[];
}

export interface AutoFixResult {
  readonly patch: import("@mc-forgelab/file-operation").FilePatch;
  readonly confidence: "low" | "medium" | "high";
  readonly rationale: string;
  readonly needsHumanReview: boolean;
}

