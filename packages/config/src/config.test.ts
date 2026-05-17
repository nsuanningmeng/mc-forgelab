import { describe, it, expect } from "vitest";
import { loadConfig, ENV_KEYS, parseSize, parseBoolean, resolvePathsFor } from "./index.js";
import { AppError } from "@mc-forgelab/app-error";

describe("config loader", () => {
  it("returns defaults when no env", () => {
    const cfg = loadConfig({ env: {}, mode: "cli", platform: "linux", homeDir: "/home/u" });
    expect(cfg.mode).toBe("cli");
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.port).toBe(3000);
    expect(cfg.auth.enabled).toBe(false);
    expect(cfg.limits.maxBuildConcurrency).toBe(1);
    expect(cfg.paths.workspace).toContain("mc-forgelab");
  });

  it("respects MC_FORGELAB_* env overrides", () => {
    const cfg = loadConfig({
      mode: "web",
      platform: "linux",
      homeDir: "/home/u",
      env: {
        [ENV_KEYS.PORT]: "8080",
        [ENV_KEYS.HOST]: "0.0.0.0",
        [ENV_KEYS.MAX_BUILD_CONCURRENCY]: "4",
        [ENV_KEYS.MAX_UPLOAD_SIZE]: "500MB",
        [ENV_KEYS.AUTH_ENABLED]: "true",
        [ENV_KEYS.ADMIN_USER]: "admin",
        [ENV_KEYS.ADMIN_PASSWORD]: "secret",
        [ENV_KEYS.LOG_LEVEL]: "debug"
      }
    });
    expect(cfg.port).toBe(8080);
    expect(cfg.host).toBe("0.0.0.0");
    expect(cfg.limits.maxBuildConcurrency).toBe(4);
    expect(cfg.limits.maxUploadSizeBytes).toBe(500 * 1024 * 1024);
    expect(cfg.auth.enabled).toBe(true);
    expect(cfg.auth.adminUser).toBe("admin");
    expect(cfg.auth.adminPasswordSet).toBe(true);
    expect(cfg.logLevel).toBe("debug");
  });

  it("rejects invalid port", () => {
    expect(() =>
      loadConfig({ mode: "cli", env: { [ENV_KEYS.PORT]: "70000" }, platform: "linux", homeDir: "/home/u" })
    ).toThrow(AppError);
  });

  it("rejects unknown mode", () => {
    expect(() => loadConfig({ env: { [ENV_KEYS.MODE]: "rocket" }, platform: "linux", homeDir: "/home/u" })).toThrow(
      AppError
    );
  });
});

describe("resolvePathsFor", () => {
  it("Docker layout", () => {
    const p = resolvePathsFor("docker", "linux", "/root", {});
    expect(p.workspace).toBe("/data/workspace");
    expect(p.db).toBe("/data/db/mc-forgelab.sqlite");
    expect(p.toolchains).toBe("/opt/mc-forgelab/toolchains");
  });

  it("Linux layout", () => {
    const p = resolvePathsFor("cli", "linux", "/home/u", {});
    expect(p.workspace).toContain("/home/u/.local/share/mc-forgelab");
    expect(p.cache).toContain("/home/u/.cache/mc-forgelab");
  });

  it("Windows layout", () => {
    const p = resolvePathsFor("cli", "win32", "C:\\\\Users\\\\u", { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" });
    expect(p.workspace).toContain("MC-ForgeLab");
  });

  it("macOS layout", () => {
    const p = resolvePathsFor("cli", "darwin", "/Users/u", {});
    expect(p.workspace).toContain("/Users/u/Library/Application Support/MC-ForgeLab");
    expect(p.cache).toContain("/Users/u/Library/Caches/MC-ForgeLab");
  });
});

describe("env helpers", () => {
  it("parseSize handles units", () => {
    expect(parseSize("100", 0)).toBe(100);
    expect(parseSize("1KB", 0)).toBe(1024);
    expect(parseSize("2MB", 0)).toBe(2 * 1024 * 1024);
    expect(parseSize("3GB", 0)).toBe(3 * 1024 ** 3);
    expect(parseSize(undefined, 42)).toBe(42);
    expect(() => parseSize("nope", 0)).toThrow(AppError);
  });

  it("parseBoolean", () => {
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("0", true)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(() => parseBoolean("maybe", false)).toThrow(AppError);
  });
});
