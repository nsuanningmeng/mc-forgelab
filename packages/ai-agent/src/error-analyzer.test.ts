import { describe, it, expect } from "vitest";
import { analyzeLog } from "./error-analyzer.js";

const JAVA_ERROR_LOG = `
> Task :compileJava FAILED
src/main/java/com/example/CheckIn.java:15: error: cannot find symbol
    getServer().getPluginManager().registerEvents(this, this);
                                  ^
  symbol:   method registerEvents(CheckIn,CheckIn)
  location: interface PluginManager
1 error

FAILURE: Build failed with an exception.
BUILD FAILED in 3s
`;

const DEPENDENCY_LOG = `
Could not resolve com.example:missing-lib:1.0.0
FAILURE: Build failed with an exception.
BUILD FAILED
`;

describe("ErrorAnalyzer", () => {
  it("extracts Java compile error", () => {
    const result = analyzeLog(JAVA_ERROR_LOG);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]?.severity).toBe("error");
    expect(result.suggestedFocusFiles).toContain("src/main/java/com/example/CheckIn.java");
  });

  it("extracts dependency error", () => {
    const result = analyzeLog(DEPENDENCY_LOG);
    expect(result.likelyCause).toContain("com.example:missing-lib");
  });

  it("truncates long logs", () => {
    const longLog = "x".repeat(25000);
    const result = analyzeLog(longLog);
    expect(result.truncated).toBe(true);
  });

  it("handles clean build log", () => {
    const result = analyzeLog("BUILD SUCCESSFUL in 5s");
    expect(result.findings).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  it("compresses log to relevant lines", () => {
    const result = analyzeLog(JAVA_ERROR_LOG);
    expect(result.compressedLog).toContain("error");
  });
});
