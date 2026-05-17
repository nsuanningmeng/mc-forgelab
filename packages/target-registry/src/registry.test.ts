import { describe, it, expect } from "vitest";
import { TargetRegistry, createDefaultRegistry, builtinTargets } from "./index.js";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";

describe("TargetRegistry", () => {
  it("registers builtin targets", () => {
    const reg = createDefaultRegistry();
    // default list excludes legacy (bukkit, spigot) and deprecated (waterfall)
    const ids = reg.list().map((t) => t.id);
    expect(ids).toEqual([
      "bungeecord", "fabric", "folia", "forge",
      "mohist", "neoforge", "paper", "purpur",
      "quilt", "velocity"
    ]);
  });

  it("registers all 13 targets including legacy and deprecated", () => {
    const reg = createDefaultRegistry();
    const ids = reg.list({ includeLegacy: true, includeDeprecated: true }).map((t) => t.id);
    expect(ids).toEqual([
      "bukkit", "bungeecord", "fabric", "folia",
      "forge", "mohist", "neoforge", "paper",
      "purpur", "quilt", "spigot", "velocity", "waterfall"
    ]);
  });

  it("filters by type", () => {
    const reg = createDefaultRegistry();
    // plugin: paper + purpur + folia (stable/experimental); spigot/bukkit excluded (legacy)
    expect(reg.list({ type: "plugin" }).map((t) => t.id)).toEqual(["folia", "paper", "purpur"]);
    expect(reg.list({ type: "mod" }).map((t) => t.id)).toEqual(["fabric", "forge", "neoforge", "quilt"]);
    // proxy: bungeecord + velocity; waterfall excluded (deprecated)
    expect(reg.list({ type: "proxy" }).map((t) => t.id)).toEqual(["bungeecord", "velocity"]);
    expect(reg.list({ type: "hybrid" }).map((t) => t.id)).toEqual(["mohist"]);
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
