import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../server.js";

let app: Awaited<ReturnType<typeof buildApp>>["app"];
let storage: Awaited<ReturnType<typeof buildApp>>["storage"];
let cfg: Awaited<ReturnType<typeof buildApp>>["cfg"];
let projectId: string;

beforeAll(async () => {
  process.env.MC_FORGELAB_MODE = "web";
  process.env.MC_FORGELAB_DB = ":memory:";
  const result = await buildApp();
  app = result.app;
  storage = result.storage;
  cfg = result.cfg;

  // Create a test project
  const res = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "FilePreviewTest",
      targetId: "paper",
      minecraftVersion: "1.20.1",
      packageName: "com.example.filepreview",
    },
  });
  expect(res.statusCode).toBe(201);
  projectId = JSON.parse(res.body).id;

  // Write test files into the project workspace
  const projectPath = join(cfg.paths.workspace, "projects", projectId);
  mkdirSync(join(projectPath, "src", "main", "java", "com", "example"), { recursive: true });
  writeFileSync(join(projectPath, "src", "main", "java", "com", "example", "Main.java"), "package com.example;\n\npublic class Main {}\n");
  writeFileSync(join(projectPath, "build.gradle.kts"), 'plugins { java }\ngroup = "com.example"\n');
  writeFileSync(join(projectPath, "README.md"), "# Test Project\n\nA test plugin.\n");
});

afterAll(async () => {
  await app.close();
  storage.close();
  // Clean up test files
  try {
    rmSync(join(cfg.paths.workspace, "projects"), { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe("GET /api/projects/:id/files/*", () => {
  it("returns file content for a valid path", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files/build.gradle.kts`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.path).toBe("build.gradle.kts");
    expect(body.content).toContain('plugins { java }');
    expect(body.contentType).toBe("text/plain; charset=utf-8");
  });

  it("returns nested file content", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files/src/main/java/com/example/Main.java`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.path).toBe("src/main/java/com/example/Main.java");
    expect(body.content).toContain("public class Main");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/nonexistent/files/build.gradle.kts",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for missing file path", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files/`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns error for nonexistent file", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files/does-not-exist.txt`,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects path traversal attempts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files/../../../etc/passwd`,
    });
    // Fastify normalizes the URL, so this becomes a 404 (file not found)
    // or 400 (path safety check). Either is acceptable.
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects absolute-style paths", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/files//etc/passwd`,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
