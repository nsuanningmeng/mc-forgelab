import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Storage, StorageBackend } from "@mc-forgelab/storage";
import { registerProxyRoutes } from "./proxy.js";
import type { AppContext } from "./types.js";

class SettingsBackend implements StorageBackend {
  readonly name = "memory";
  private readonly settings = new Map<string, string>();

  exec(): void {}

  all<T = Record<string, unknown>>(): T[] {
    return [...this.settings.entries()].map(([key, value]) => ({ key, value, updated_at: "2026-01-01T00:00:00.000Z" })) as T[];
  }

  get<T = Record<string, unknown>>(_sql: string, params: ReadonlyArray<string | number | null> = []): T | undefined {
    const key = String(params[0] ?? "");
    const value = this.settings.get(key);
    return value === undefined ? undefined : ({ value } as T);
  }

  run(_sql: string, params: ReadonlyArray<string | number | null> = []): { changes: number; lastInsertRowid: number } {
    const key = String(params[0] ?? "");
    const value = String(params[1] ?? "");
    this.settings.set(key, value);
    return { changes: 1, lastInsertRowid: this.settings.size };
  }

  close(): void {
    this.settings.clear();
  }
}

let app: FastifyInstance;
let backend: SettingsBackend;

function makeContext(): AppContext {
  const storage: Storage = {
    backend,
    getSetting: (key) => backend.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])?.value,
    setSetting: (key, value) => { backend.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]); },
    listSettings: () => [],
    deleteSetting: () => undefined,
    close: () => backend.close(),
  };

  return {
    storage,
    artifacts: {},
    cfg: {},
    providers: {},
    workflowRuntime: {},
    builds: {},
    auditor: { log: () => undefined },
  } as AppContext;
}

beforeEach(async () => {
  backend = new SettingsBackend();
  app = Fastify({ logger: false });
  await registerProxyRoutes(app, makeContext());
});

afterEach(async () => {
  await app.close();
});

describe("proxy settings routes", () => {
  it("returns an empty initial proxy configuration", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings/proxy" });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      http: "",
      https: "",
      username: "",
      password: false,
      noProxy: "",
    });
  });

  it("persists HTTP proxy settings", async () => {
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/settings/proxy",
      payload: { http: "proxy.internal", httpPort: 8080 },
    });
    expect(patch.statusCode).toBe(200);

    const get = await app.inject({ method: "GET", url: "/api/settings/proxy" });
    expect(JSON.parse(get.body)).toMatchObject({
      http: "proxy.internal",
      httpPort: 8080,
    });
  });

  it("rejects invalid proxy ports", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings/proxy",
      payload: { http: "proxy.internal", httpPort: 70000 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("does not return the proxy password in clear text", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings/proxy",
      payload: { username: "build", password: "secret-password" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { password: unknown };
    expect(body.password).toBe(true);
    expect(res.body).not.toContain("secret-password");
  });
});
