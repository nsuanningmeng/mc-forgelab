import { EventEmitter } from "node:events";
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ToolchainStatus } from "@mc-forgelab/toolchain-manager";

const spawnSyncMock = vi.fn();
const httpsGetMock = vi.fn();
const inspectToolchainsMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}));

vi.mock("node:https", async () => {
  const actual = await vi.importActual<typeof import("node:https")>("node:https");
  return { ...actual, get: httpsGetMock };
});

vi.mock("@mc-forgelab/toolchain-manager", () => ({
  doctor: inspectToolchainsMock,
}));

const doctor = await import("./doctor.js");

function okNetworkGet(_url: string, _options: unknown, callback: (res: EventEmitter & { statusCode: number; resume: () => void }) => void) {
  const req = new EventEmitter() as EventEmitter & {
    setTimeout: (ms: number, cb: () => void) => void;
    destroy: (error?: Error) => void;
  };
  req.setTimeout = vi.fn();
  req.destroy = vi.fn((error?: Error) => {
    if (error) req.emit("error", error);
  });

  process.nextTick(() => {
    const res = new EventEmitter() as EventEmitter & { statusCode: number; resume: () => void };
    res.statusCode = 200;
    res.resume = vi.fn();
    callback(res);
  });
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  inspectToolchainsMock.mockResolvedValue([
    { toolName: "java", requestedVersion: "17", installed: true, version: "17", path: "java", issues: [] },
  ] satisfies ToolchainStatus[]);
  httpsGetMock.mockImplementation(okNetworkGet);
  spawnSyncMock.mockReturnValue({ stdout: "Docker version 27.0.0\n", stderr: "", status: 0 });
});

describe("doctor command checks", () => {
  it("collectChecks returns named status lines", async () => {
    const checks = await doctor.collectChecks({
      env: { MC_FORGELAB_DB: ":memory:" },
      platform: process.platform,
      stdout: process.stdout,
      stderr: process.stderr,
    });

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "OS", status: "ok" }),
      expect.objectContaining({ name: "JDK 17", status: "ok" }),
      expect.objectContaining({ name: "network", detail: "4/4 reachable" }),
    ]));
  });

  it("checkNetwork maps successful responses to ok checks", async () => {
    const checks = await doctor.checkNetwork();

    expect(checks).toHaveLength(4);
    expect(checks.every((check) => check.status === "ok")).toBe(true);
    expect(checks.every((check) => typeof check.latencyMs === "number")).toBe(true);
  });

  it("maps toolchain names and statuses", () => {
    expect(doctor.toolchainName({ toolName: "java", requestedVersion: "21", installed: true, version: "21", issues: [] })).toBe("JDK 21");
    expect(doctor.toolchainName({ toolName: "gradle", installed: true, version: "8.8", issues: [] })).toBe("Gradle");
    expect(doctor.toolchainName({ toolName: "maven", installed: false, version: null, issues: ["missing"] })).toBe("Maven");
    expect(doctor.toolchainCheckStatus({ toolName: "gradle", installed: true, version: "8.8", issues: [] })).toBe("ok");
    expect(doctor.toolchainCheckStatus({ toolName: "maven", installed: true, version: "3.9.9", issues: ["fallback"] })).toBe("warn");
    expect(doctor.toolchainCheckStatus({ toolName: "java", installed: false, version: null, issues: ["missing"] })).toBe("miss");
  });
});
