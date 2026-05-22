import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runBuild } from "./index.js";

vi.mock("@mc-forgelab/toolchain-manager", () => ({
  resolveJava: vi.fn(async () => ({ executable: "java", env: {} })),
  resolveJavaWithAutoDownload: vi.fn(async () => ({ executable: "java", env: {} })),
  resolveGradleWrapper: vi.fn(async () => ({ executable: "gradle", env: {} })),
  bootstrapGradleWrapper: vi.fn(async () => ({ executable: "gradle", env: {} })),
  resolveMavenWrapper: vi.fn(async () => ({ executable: "mvn", env: {} })),
  bootstrapMavenWrapper: vi.fn(async () => ({ executable: "mvn", env: {} })),
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => boolean;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn(() => true);
    process.nextTick(() => proc.emit("close", 0));
    return proc;
  }),
}));

describe("runBuild", () => {
  it("uses an injected buildId for returned records and log paths", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "mcfl-build-"));
    const projectPath = join(workspaceRoot, "project");
    const buildId = "00000000-0000-4000-8000-000000000001";
    mkdirSync(projectPath);

    try {
      const rec = await runBuild("project-1", {
        buildId,
        workspaceRoot,
        projectPath,
        logsDir: join(workspaceRoot, "logs"),
      });

      expect(rec.buildId).toBe(buildId);
      expect(rec.logPath).toContain(buildId);
    } finally {
      try {
        rmSync(workspaceRoot, { recursive: true, force: true });
      } catch {
        // The write stream may finish a tick later on Windows.
      }
    }
  });

  it.each(["../escape", "..\\escape", "logs/escape", "logs\\escape", "safe..escape", "bad id"])(
    "rejects unsafe buildId %s",
    async (buildId) => {
      const workspaceRoot = mkdtempSync(join(tmpdir(), "mcfl-build-"));
      const projectPath = join(workspaceRoot, "project");
      mkdirSync(projectPath);

      try {
        await expect(runBuild("project-1", {
          buildId,
          workspaceRoot,
          projectPath,
          logsDir: join(workspaceRoot, "logs"),
        })).rejects.toThrow(/buildId/);
      } finally {
        rmSync(workspaceRoot, { recursive: true, force: true });
      }
    }
  );
});
