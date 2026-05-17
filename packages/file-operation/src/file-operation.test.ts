import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveInsideBase, validatePatch, type FilePatch } from "./patch.js";
import { createFileOperationService } from "./service.js";

describe("resolveInsideBase", () => {
  it("allows valid relative paths", () => {
    const base = "/workspace/project";
    expect(resolveInsideBase(base, "src/Main.java")).toContain("Main.java");
  });
  it("rejects path traversal", () => {
    expect(() => resolveInsideBase("/workspace", "../etc/passwd")).toThrow();
  });
  it("rejects absolute paths", () => {
    expect(() => resolveInsideBase("/workspace", "/etc/passwd")).toThrow();
  });
});

describe("validatePatch", () => {
  const root = "/workspace";
  it("accepts valid patch", () => {
    const patch: FilePatch = { type: "file_patch", summary: "test", operations: [{ op: "create", path: "src/A.java", content: "class A {}" }] };
    expect(validatePatch(patch, root).valid).toBe(true);
  });
  it("rejects path traversal in operations", () => {
    const patch: FilePatch = { type: "file_patch", summary: "bad", operations: [{ op: "create", path: "../evil.sh", content: "rm -rf /" }] };
    expect(validatePatch(patch, root).valid).toBe(false);
  });
  it("rejects unsafe newPath in move operation", () => {
    const patch: FilePatch = { type: "file_patch", summary: "bad move", operations: [{ op: "move", path: "src/A.java", newPath: "../evil.sh" }] };
    expect(validatePatch(patch, root).valid).toBe(false);
  });
  it("rejects move without newPath", () => {
    const patch: FilePatch = { type: "file_patch", summary: "bad", operations: [{ op: "move", path: "src/A.java" }] };
    expect(validatePatch(patch, root).valid).toBe(false);
  });
});

describe("FileOperationService", () => {
  it("creates, reads, updates, deletes files", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcfl-test-"));
    try {
      const svc = createFileOperationService();
      svc.createFile(dir, "src/Hello.java", "class Hello {}");
      expect(svc.readFile(dir, "src/Hello.java")).toBe("class Hello {}");
      svc.updateFile(dir, "src/Hello.java", "class Hello { int x; }");
      expect(svc.readFile(dir, "src/Hello.java")).toContain("int x");
      svc.deleteFile(dir, "src/Hello.java");
      expect(() => svc.readFile(dir, "src/Hello.java")).toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("applies a patch", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcfl-patch-"));
    try {
      const svc = createFileOperationService();
      const patch: FilePatch = {
        type: "file_patch", summary: "create plugin",
        operations: [
          { op: "create", path: "build.gradle.kts", content: "plugins { java }" },
          { op: "create", path: "src/Main.java", content: "class Main {}" }
        ]
      };
      const result = svc.applyPatch(dir, patch);
      expect(result.applied).toBe(2);
      expect(result.errors).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("rejects unsafe patch", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcfl-unsafe-"));
    try {
      const svc = createFileOperationService();
      const patch: FilePatch = { type: "file_patch", summary: "evil", operations: [{ op: "create", path: "../evil.sh", content: "rm -rf /" }] };
      expect(() => svc.applyPatch(dir, patch)).toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
