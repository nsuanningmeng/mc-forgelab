/**
 * @mc-forgelab/artifact-manager — 阶段 6 实施
 *
 * 产物类型: jar / zip / source / log / manifest
 * 下载接口必须：流式、Content-Disposition、Content-Type、路径校验、防穿越
 * 限制只能下载 workspace/artifacts 与 project dist 允许区
 */

export type ArtifactType = "jar" | "zip" | "source" | "log" | "manifest";

export interface ArtifactRecord {
  readonly artifactId: string;
  readonly projectId: string;
  readonly buildId: string;
  readonly fileName: string;
  readonly filePath: string;
  readonly fileSize: number;
  readonly sha256: string;
  readonly type: ArtifactType;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly createdAt: string;
  readonly downloadable: boolean;
}

export interface ArtifactManifest {
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly projectName: string;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildId: string;
  readonly builtAt: string;
  readonly outputs: ReadonlyArray<{
    readonly fileName: string;
    readonly type: ArtifactType;
    readonly sha256: string;
    readonly sizeBytes: number;
  }>;
  readonly compatibilityWarnings: ReadonlyArray<{
    readonly code: string;
    readonly level: "info" | "warning" | "error";
    readonly messageZh: string;
    readonly messageEn: string;
  }>;
}

export interface ArtifactManager {
  list(projectId: string): Promise<ArtifactRecord[]>;
  get(artifactId: string): Promise<ArtifactRecord>;
  delete(artifactId: string): Promise<void>;
  openDownloadStream(artifactId: string): Promise<NodeJS.ReadableStream>;
  packSource(projectId: string): Promise<ArtifactRecord>;
}

export function createArtifactManager(): ArtifactManager {
  return {
    async list() {
      throw new Error("artifact-manager: not implemented (stage 6)");
    },
    async get() {
      throw new Error("artifact-manager: not implemented (stage 6)");
    },
    async delete() {
      throw new Error("artifact-manager: not implemented (stage 6)");
    },
    async openDownloadStream() {
      throw new Error("artifact-manager: not implemented (stage 6)");
    },
    async packSource() {
      throw new Error("artifact-manager: not implemented (stage 6)");
    }
  };
}
