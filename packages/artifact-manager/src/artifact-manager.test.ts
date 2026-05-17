import { describe, it, expect, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { openStorage, BASE_MIGRATIONS, STAGE6_MIGRATIONS } from "@mc-forgelab/storage";
import { createArtifactManager } from "./index.js";

async function makeManager() {
  const storage = await openStorage({ backend: "memory", migrations: [...BASE_MIGRATIONS, ...STAGE6_MIGRATIONS] });
  return { manager: createArtifactManager(storage), storage };
}

describe("ArtifactManager", () => {
  it("rejects path traversal in openDownload", async () => {
    const { manager, storage } = await makeManager();
    const dir = mkdtempSync(join(tmpdir(), "mcfl-art-"));
    try {
      // Insert a fake artifact with traversal path
      storage.backend.run(
        "INSERT INTO artifacts (id, project_id, build_id, file_name, file_path, file_size, sha256, type, target_id, minecraft_version, java_version, created_at, expires_at, downloadable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["bad-id", "p1", "b1", "evil.jar", join(dir, "../../../etc/passwd"), 0, "abc", "jar", "paper", "1.20.1", 17, new Date().toISOString(), new Date(Date.now() + 86400000).toISOString(), 1]
      );
      await expect(manager.openDownload("bad-id", dir)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("pruneExpired removes old artifacts", async () => {
    const { manager, storage } = await makeManager();
    const dir = mkdtempSync(join(tmpdir(), "mcfl-prune-"));
    try {
      const oldDate = new Date(Date.now() - 40 * 86400_000).toISOString();
      const filePath = join(dir, "old.jar");
      writeFileSync(filePath, "fake");
      storage.backend.run(
        "INSERT INTO artifacts (id, project_id, build_id, file_name, file_path, file_size, sha256, type, target_id, minecraft_version, java_version, created_at, expires_at, downloadable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["old-id", "p1", "b1", "old.jar", filePath, 4, "abc", "jar", "paper", "1.20.1", 17, oldDate, oldDate, 1]
      );
      const result = await manager.pruneExpired(dir, 30);
      expect(result.deleted).toBe(1);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
