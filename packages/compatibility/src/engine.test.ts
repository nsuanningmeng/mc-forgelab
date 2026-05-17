import { describe, it, expect } from "vitest";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";
import { CompatibilityEngine, builtinRules, getMinecraftVersion } from "./index.js";

const reg = createDefaultRegistry();
const engine = new CompatibilityEngine(reg, builtinRules);

describe("CompatibilityEngine", () => {
  it("clean run on paper 1.20.4 / Java 17 produces no blocking issues", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.20.4",
      javaVersion: 17
    });
    expect(out.hasBlocking).toBe(false);
    expect(out.results.filter((r) => r.level === "error").length).toBe(0);
  });

  it("Velocity declared on Paper is blocking", () => {
    const out = engine.evaluate({
      targetId: "velocity",
      minecraftVersion: "1.20.4",
      javaVersion: 17,
      declaredPlatform: "paper"
    });
    expect(out.hasBlocking).toBe(true);
    expect(out.results.some((r) => r.code === "VELOCITY_NOT_BUKKIT_PLUGIN" && r.blocking)).toBe(true);
  });

  it("NMS on paper emits warning, not blocking", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.20.4",
      javaVersion: 17,
      usesNms: true
    });
    expect(out.hasBlocking).toBe(false);
    expect(out.results.some((r) => r.code === "NMS_VERSION_LOCK" && r.level === "warning")).toBe(true);
  });

  it("Java 8 on Paper is rejected (out of range)", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.20.4",
      javaVersion: 8
    });
    expect(out.hasBlocking).toBe(true);
    expect(out.results.some((r) => r.code === "JAVA_VERSION_OUT_OF_RANGE")).toBe(true);
  });

  it("Java 17 on MC 1.20.6 (Java 21 required) is rejected", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.20.6",
      javaVersion: 17
    });
    expect(out.results.some((r) => r.code === "MINECRAFT_JAVA_MISMATCH" && r.blocking)).toBe(true);
  });

  it("MC 1.12.2 emits legacy warning", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.16.5",
      javaVersion: 8
    });
    expect(out.results.some((r) => r.code === "MINECRAFT_VERSION_LEGACY")).toBe(true);
  });

  it("unknown MC version returns info-level skip notice", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "9.99.99",
      javaVersion: 17
    });
    expect(out.results.some((r) => r.code === "MINECRAFT_VERSION_UNKNOWN")).toBe(true);
  });

  it("returns counts breakdown", () => {
    const out = engine.evaluate({
      targetId: "paper",
      minecraftVersion: "1.20.4",
      javaVersion: 17
    });
    expect(out.counts.info).toBeGreaterThanOrEqual(0);
    expect(out.counts.warning + out.counts.error).toBeGreaterThanOrEqual(0);
  });

  it("MINECRAFT_VERSIONS metadata accessible", () => {
    expect(getMinecraftVersion("1.20.1")?.recommendedJavaVersion).toBe(17);
    expect(getMinecraftVersion("1.20.6")?.recommendedJavaVersion).toBe(21);
  });
});
