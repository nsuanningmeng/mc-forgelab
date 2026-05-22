import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const spawnSyncMock = vi.fn();
const httpsGetMock = vi.fn();

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return { ...actual, spawnSync: spawnSyncMock };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: vi.fn(() => false) };
});

vi.mock("node:https", async () => {
  const actual = await vi.importActual<typeof import("node:https")>("node:https");
  return { ...actual, get: httpsGetMock };
});

const toolchain = await import("./index.js");

function spawnResult(stdout = "", stderr = "", status = 0, error?: Error) {
  return { stdout, stderr, status, error };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MC_FORGELAB_PROXY_HTTP;
  delete process.env.MC_FORGELAB_PROXY_HTTPS;
  delete process.env.MC_FORGELAB_PROXY_NO_PROXY;
  spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
    if (/^(which|where\.exe)$/.test(cmd)) return spawnResult(`/usr/bin/${args[0]}\n`);
    if (/java/.test(cmd) && args[0] === "-version") return spawnResult("", 'openjdk version "21.0.5" 2024-10-15\n');
    if (/gradle/.test(cmd) && args[0] === "--version") return spawnResult("Gradle 8.8\n");
    if (/mvn/.test(cmd) && args[0] === "--version") return spawnResult("Apache Maven 3.9.9\n");
    return spawnResult("", "", 1);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("doctor", () => {
  it("returns Java, Gradle, and Maven status rows", async () => {
    const statuses = await toolchain.doctor();

    expect(statuses.some((status) => status.toolName === "java")).toBe(true);
    expect(statuses).toContainEqual(expect.objectContaining({
      toolName: "gradle",
      installed: true,
      version: "8.8",
    }));
    expect(statuses).toContainEqual(expect.objectContaining({
      toolName: "maven",
      installed: true,
      version: "3.9.9",
    }));
  });
});

describe("tryExecFull", () => {
  it("reports successful command execution", () => {
    spawnSyncMock.mockReturnValueOnce(spawnResult("ok\n", "", 0));

    expect(toolchain.tryExecFull("java", ["-version"])).toEqual({
      cmd: "java",
      ok: true,
      status: 0,
      stdout: "ok\n",
      stderr: "",
      error: null,
    });
  });

  it("reports non-zero exits", () => {
    spawnSyncMock.mockReturnValueOnce(spawnResult("", "bad\n", 2));

    expect(toolchain.tryExecFull("gradle", ["build"])).toEqual(expect.objectContaining({
      ok: false,
      status: 2,
      stderr: "bad\n",
      error: "exit code 2",
    }));
  });

  it("reports spawn errors such as timeouts", () => {
    spawnSyncMock.mockReturnValueOnce(spawnResult("", "", null as unknown as number, new Error("spawn ETIMEDOUT")));

    expect(toolchain.tryExecFull("mvn", ["package"])).toEqual(expect.objectContaining({
      ok: false,
      status: null,
      error: "spawn ETIMEDOUT",
    }));
  });
});

describe("parseJavaMajor", () => {
  it.each([
    ['openjdk version "1.8.0_411"', 8],
    ['openjdk version "21.0.5" 2024-10-15', 21],
    ['java version "17.0.13"', 17],
    ["not java", null],
  ])("parses %s", (input, expected) => {
    expect(toolchain.parseJavaMajor(input)).toBe(expected);
  });
});

describe("getProxyAgent", () => {
  it("returns undefined without proxy configuration", () => {
    expect(toolchain.getProxyAgent("https://api.adoptium.net/v3/info")).toBeUndefined();
  });

  it("returns an agent when HTTP proxy is configured", () => {
    process.env.MC_FORGELAB_PROXY_HTTP = "127.0.0.1:8080";

    expect(toolchain.getProxyAgent("https://api.adoptium.net/v3/info")).toBeDefined();
  });

  it("honors no-proxy host rules", () => {
    process.env.MC_FORGELAB_PROXY_HTTP = "http://127.0.0.1:8080";
    process.env.MC_FORGELAB_PROXY_NO_PROXY = ".adoptium.net";

    expect(toolchain.getProxyAgent("https://api.adoptium.net/v3/info")).toBeUndefined();
  });
});
