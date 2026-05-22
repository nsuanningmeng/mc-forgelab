import { describe, expect, it } from "vitest";
import { detectGradleJavaVersion } from "./java-version.js";

describe("detectGradleJavaVersion", () => {
  it("detects Java toolchain versions", () => {
    expect(detectGradleJavaVersion("java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }")).toEqual({
      version: 21,
      source: "toolchain",
      rawValue: "21",
    });
  });

  it("detects legacy 1.8 sourceCompatibility", () => {
    expect(detectGradleJavaVersion('sourceCompatibility = "1.8"')).toEqual({
      version: 8,
      source: "sourceCompatibility",
      rawValue: "1.8",
    });
  });

  it("ignores commented Java version declarations", () => {
    expect(detectGradleJavaVersion("// sourceCompatibility = 17\nplugins { java }")).toEqual({
      version: null,
      source: "none",
    });
  });
});
