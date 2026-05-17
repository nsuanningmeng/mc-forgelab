import { describe, it, expect } from "vitest";
import { TargetRegistry, createDefaultRegistry, builtinTargets } from "./index.js";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";

describe("TargetRegistry", () => {
  it("registers builtin targets (paper, fabric, velocity)", () => {
    const reg = createDefaultRegistry();
    const ids = reg.list().map((t) => t.id).sort();
    expect(ids).toEqual(["fabric", "paper", "velocity"]);
  });

  it("filters by type", () => {
    const reg = createDefaultRegistry();
    expect(reg.list({ type: "plugin" }).map((t) => t.id)).toEqual(["paper"]);
    expect(reg.list({ type: "mod" }).map((t) => t.id)).toEqual(["fabric"]);
    expect(reg.list({ type: "proxy" }).map((t) => t.id)).toEqual(["velocity"]);
  });

  it("get throws TARGET_NOT_FOUND for missing id", () => {
    const reg = createDefaultRegistry();
    expect(() => reg.get("nonexistent")).toThrow(AppError);
    try {
      reg.get("nonexistent");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(ErrorCode.TARGET_NOT_FOUND);
    }
  });

  it("register rejects duplicate id", () => {
    const reg = new TargetRegistry([]);
    reg.register(builtinTargets[0]!);
    expect(() => reg.register(builtinTargets[0]!)).toThrow(AppError);
  });

  it("summaries omit verbose fields", () => {
    const reg = createDefaultRegistry();
    const s = reg.summaries()[0]!;
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("displayName");
    expect(s).toHaveProperty("recommendedBuildTool");
    expect(s).not.toHaveProperty("capabilities");
  });

  it("capabilities flags are coherent for velocity", () => {
    const reg = createDefaultRegistry();
    const v = reg.get("velocity");
    expect(v.capabilities.supportsProxy).toBe(true);
    expect(v.capabilities.supportsBukkitApi).toBe(false);
    expect(v.capabilities.supportsPaperApi).toBe(false);
  });

  it("fabric supports mixin and mods, not plugins", () => {
    const f = createDefaultRegistry().get("fabric");
    expect(f.capabilities.supportsMods).toBe(true);
    expect(f.capabilities.supportsMixin).toBe(true);
    expect(f.capabilities.supportsPlugins).toBe(false);
  });
});
