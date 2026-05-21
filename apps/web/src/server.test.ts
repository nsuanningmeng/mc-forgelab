import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "./server.js";

let app: Awaited<ReturnType<typeof buildApp>>["app"];
let storage: Awaited<ReturnType<typeof buildApp>>["storage"];

beforeAll(async () => {
  process.env.MC_FORGELAB_MODE = "web";
  process.env.MC_FORGELAB_DB = ":memory:";
  const result = await buildApp();
  app = result.app;
  storage = result.storage;
});

afterAll(async () => {
  await app.close();
  storage.close();
});

describe("GET /api/health", () => {
  it("returns version and storage metadata", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
      version: "0.4.1",
      storage: "memory",
      persistent: false,
    });
  });
});

describe("Projects API", () => {
  it("creates and lists projects", async () => {
    const create = await app.inject({
      method: "POST", url: "/api/projects",
      payload: { name: "TestPlugin", targetId: "paper", minecraftVersion: "1.20.1", packageName: "com.example.test" },
    });
    expect(create.statusCode).toBe(201);
    const project = JSON.parse(create.body);
    expect(project.name).toBe("TestPlugin");

    const list = await app.inject({ method: "GET", url: "/api/projects" });
    expect(JSON.parse(list.body).length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown project", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects/nonexistent" });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a project", async () => {
    const create = await app.inject({
      method: "POST", url: "/api/projects",
      payload: { name: "ToDelete" },
    });
    const { id } = JSON.parse(create.body);
    const del = await app.inject({ method: "DELETE", url: `/api/projects/${id}` });
    expect(del.statusCode).toBe(204);
  });

  it("persists selected target and Minecraft version (regression: field-name mismatch)", async () => {
    const create = await app.inject({
      method: "POST", url: "/api/projects",
      payload: {
        name: "ForgePicked",
        targetId: "forge",
        minecraftVersion: "1.21.4",
        packageName: "com.example.forgepicked",
      },
    });
    expect(create.statusCode).toBe(201);
    const project = JSON.parse(create.body);
    expect(project.target_id).toBe("forge");
    expect(project.minecraft_version).toBe("1.21.4");
  });

  it("accepts every target id exposed by /api/targets (regression: VALID_TARGETS drift)", async () => {
    const targets = JSON.parse((await app.inject({ method: "GET", url: "/api/targets" })).body) as Array<{ id: string }>;
    for (const t of targets) {
      const res = await app.inject({
        method: "POST", url: "/api/projects",
        payload: {
          name: `T_${t.id}`,
          targetId: t.id,
          minecraftVersion: "1.20.4",
          packageName: `com.example.${t.id.replace(/[^a-z0-9]/g, "")}`,
        },
      });
      expect(res.statusCode, `target ${t.id} should be accepted`).toBe(201);
    }
  });
});

describe("AI routes", () => {
  it("lists workflows", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai/workflows" });
    expect(res.statusCode).toBe(200);
  });
});
