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
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
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
});

describe("AI routes", () => {
  it("lists workflows", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai/workflows" });
    expect(res.statusCode).toBe(200);
  });
});
