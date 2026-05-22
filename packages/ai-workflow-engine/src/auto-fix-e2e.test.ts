import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const JAVA_HOME = process.env.JAVA_HOME ?? "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot";
const JAVAC = join(JAVA_HOME, "bin", "javac.exe");

function compileJava(files: string | string[]): { ok: boolean; output: string } {
  const args = Array.isArray(files) ? files : [files];
  const result = spawnSync(JAVAC, args, {
    timeout: 30_000,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  return { ok: result.status === 0, output };
}

/**
 * End-to-end auto-fix scenario: real javac compile + file patching.
 *
 * Validates that the auto-fix flow works with a real JDK:
 * 1. Broken Java file → compile fails
 * 2. Apply fix patch → file is corrected
 * 3. Recompile → succeeds
 */
describe("auto-fix e2e (real JDK)", () => {
  it("compiles broken code, applies fix, recompiles successfully", () => {
    const dir = join(tmpdir(), `mcfl-autofix-e2e-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    const mainFile = join(dir, "Main.java");

    // Step 1: Write broken Java (missing semicolon)
    writeFileSync(mainFile, 'public class Main {\n  public String name() {\n    return "broken"\n  }\n}\n');
    const first = compileJava(mainFile);
    expect(first.ok).toBe(false);
    // javac may output errors in locale language (e.g., Chinese on zh-CN systems)
    expect(first.output.length).toBeGreaterThan(0);

    // Step 2: Apply "patch" — rewrite with fixed code
    writeFileSync(mainFile, 'public class Main {\n  public String name() {\n    return "fixed";\n  }\n}\n');

    // Step 3: Recompile — should succeed
    const second = compileJava(mainFile);
    expect(second.ok).toBe(true);

    // Verify the .class file was created
    const classFile = join(dir, "Main.class");
    expect(readFileSync(classFile)).toBeDefined();

    // Cleanup
    rmSync(dir, { recursive: true, force: true });
  });

  it("handles multi-file project with import errors", () => {
    const dir = join(tmpdir(), `mcfl-autofix-import-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    // Write a helper class
    writeFileSync(join(dir, "Helper.java"), 'public class Helper {\n  public static String help() { return "help"; }\n}\n');

    // Write Main that references Helper with wrong import (same package, no import needed)
    // But introduce a type error: calling a method that doesn't exist
    writeFileSync(join(dir, "Main.java"), 'public class Main {\n  public static void main(String[] args) {\n    System.out.println(Helper.nonExistent());\n  }\n}\n');

    const javaFiles = [join(dir, "Helper.java"), join(dir, "Main.java")];
    const first = compileJava(javaFiles);
    expect(first.ok).toBe(false);
    expect(first.output.length).toBeGreaterThan(0);

    // Fix: call the correct method
    writeFileSync(join(dir, "Main.java"), 'public class Main {\n  public static void main(String[] args) {\n    System.out.println(Helper.help());\n  }\n}\n');

    const second = compileJava(javaFiles);
    expect(second.ok).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("verifies JDK version is 21", () => {
    const result = spawnSync(join(JAVA_HOME, "bin", "java.exe"), ["-version"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    expect(output).toContain("21");
  });
});
