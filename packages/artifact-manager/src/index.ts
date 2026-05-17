import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, statSync, existsSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { resolveInsideBase } from "@mc-forgelab/file-operation";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { Storage } from "@mc-forgelab/storage";
import type { BuildRecord } from "@mc-forgelab/build-orchestrator";

export type ArtifactType = "jar" | "source" | "log" | "manifest";

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
  readonly expiresAt: string;
  readonly downloadable: boolean;
}

export interface CreateArtifactsInput {
  readonly projectId: string;
  readonly projectName: string;
  readonly build: BuildRecord;
  readonly workspaceRoot: string;
  readonly projectPath: string;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly retentionDays?: number;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

function artifactsRoot(workspaceRoot: string, projectId: string, buildId: string): string {
  return join(workspaceRoot, "artifacts", projectId, buildId);
}

function rowToRecord(row: Record<string, unknown>): ArtifactRecord {
  return {
    artifactId: row.id as string,
    projectId: row.project_id as string,
    buildId: row.build_id as string,
    fileName: row.file_name as string,
    filePath: row.file_path as string,
    fileSize: row.file_size as number,
    sha256: row.sha256 as string,
    type: row.type as ArtifactType,
    targetId: row.target_id as string,
    minecraftVersion: row.minecraft_version as string,
    javaVersion: row.java_version as number,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    downloadable: (row.downloadable as number) === 1,
  };
}

export function createArtifactManager(storage: Storage) {
  return {
    async createForSuccessfulBuild(input: CreateArtifactsInput): Promise<ArtifactRecord[]> {
      const { projectId, projectName, build, workspaceRoot, projectPath, targetId, minecraftVersion, javaVersion } = input;
      const outDir = artifactsRoot(workspaceRoot, projectId, build.buildId);
      mkdirSync(outDir, { recursive: true });

      const records: ArtifactRecord[] = [];
      const now = new Date().toISOString();
      const days = input.retentionDays ?? 30;
      const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();

      const save = async (src: string, type: ArtifactType, destName: string) => {
        const dest = join(outDir, destName);
        await pipeline(createReadStream(src), createWriteStream(dest));
        const sha = await sha256File(dest);
        const size = statSync(dest).size;
        const id = randomUUID();
        storage.backend.run(
          "INSERT INTO artifacts (id, project_id, build_id, file_name, file_path, file_size, sha256, type, target_id, minecraft_version, java_version, created_at, expires_at, downloadable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, projectId, build.buildId, destName, dest, size, sha, type, targetId, minecraftVersion, javaVersion, now, expiresAt, 1]
        );
        records.push(rowToRecord(storage.backend.get("SELECT * FROM artifacts WHERE id = ?", [id])!));
      };

      // jar: find in build/libs/
      const libsDir = join(projectPath, "build", "libs");
      if (existsSync(libsDir)) {
        const jars = readdirSync(libsDir).filter((f) => f.endsWith(".jar") && !f.endsWith("-sources.jar"));
        for (const jar of jars) await save(join(libsDir, jar), "jar", jar);
      }

      // build.log
      if (build.logPath && existsSync(build.logPath)) {
        await save(build.logPath, "log", "build.log");
      }

      // manifest.json
      const manifestPath = join(outDir, "manifest.json");
      const manifest = { schemaVersion: 1, projectId, projectName, targetId, minecraftVersion, javaVersion, buildId: build.buildId, builtAt: now, artifacts: records.map((r) => ({ fileName: r.fileName, type: r.type, sha256: r.sha256, sizeBytes: r.fileSize })) };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      const mSha = await sha256File(manifestPath);
      const mSize = statSync(manifestPath).size;
      const mId = randomUUID();
      storage.backend.run(
        "INSERT INTO artifacts (id, project_id, build_id, file_name, file_path, file_size, sha256, type, target_id, minecraft_version, java_version, created_at, expires_at, downloadable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [mId, projectId, build.buildId, "manifest.json", manifestPath, mSize, mSha, "manifest", targetId, minecraftVersion, javaVersion, now, expiresAt, 1]
      );
      records.push(rowToRecord(storage.backend.get("SELECT * FROM artifacts WHERE id = ?", [mId])!));

      return records;
    },

    async list(projectId: string): Promise<ArtifactRecord[]> {
      return storage.backend.all<Record<string, unknown>>(
        "SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC", [projectId]
      ).map(rowToRecord);
    },

    async get(artifactId: string): Promise<ArtifactRecord> {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM artifacts WHERE id = ?", [artifactId]);
      if (!row) throw new AppError(ErrorCode.ARTIFACT_NOT_FOUND, { details: { artifactId } });
      return rowToRecord(row);
    },

    async openDownload(artifactId: string, workspaceRoot: string) {
      const record = await this.get(artifactId);
      if (!record.downloadable) throw new AppError(ErrorCode.ARTIFACT_NOT_FOUND, { details: { artifactId, reason: "not downloadable" } });
      const artifactsBase = join(workspaceRoot, "artifacts");
      // Use the resolved safe path — not the raw DB path
      const safePath = resolveInsideBase(artifactsBase, record.filePath.replace(artifactsBase, "").replace(/^[/\\]/, "") || ".");
      if (!existsSync(safePath)) throw new AppError(ErrorCode.ARTIFACT_NOT_FOUND, { details: { artifactId, reason: "file missing" } });
      const stat = statSync(safePath);
      const ext = record.fileName.split(".").pop() ?? "";
      const contentType = ext === "jar" ? "application/java-archive" : ext === "json" ? "application/json" : ext === "log" ? "text/plain" : "application/octet-stream";
      return { record, stream: createReadStream(safePath), contentType, contentLength: stat.size, contentDisposition: `attachment; filename="${record.fileName}"`, sha256: record.sha256 };
    },

    async delete(artifactId: string, workspaceRoot?: string): Promise<void> {
      const record = await this.get(artifactId);
      if (workspaceRoot && existsSync(record.filePath)) {
        const artifactsBase = join(workspaceRoot, "artifacts");
        try {
          const safePath = resolveInsideBase(artifactsBase, record.filePath.replace(artifactsBase, "").replace(/^[/\\]/, "") || ".");
          rmSync(safePath);
        } catch { /* path outside base — skip file deletion */ }
      }
      storage.backend.run("DELETE FROM artifacts WHERE id = ?", [artifactId]);
    },

    async pruneExpired(workspaceRoot: string, maxAgeDays = 30): Promise<{ deleted: number }> {
      const cutoff = new Date(Date.now() - maxAgeDays * 86400_000).toISOString();
      const expired = storage.backend.all<Record<string, unknown>>(
        "SELECT * FROM artifacts WHERE created_at < ?", [cutoff]
      ).map(rowToRecord);
      const artifactsBase = join(workspaceRoot, "artifacts");
      for (const r of expired) {
        try {
          const safePath = resolveInsideBase(artifactsBase, r.filePath.replace(artifactsBase, "").replace(/^[/\\]/, "") || ".");
          if (existsSync(safePath)) rmSync(safePath);
        } catch { /* skip unsafe paths */ }
        storage.backend.run("DELETE FROM artifacts WHERE id = ?", [r.artifactId]);
      }
      return { deleted: expired.length };
    },
  };
}
