import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate, listTemplates } from "./index.js";
import type { ProjectSpec } from "@mc-forgelab/project-model";

const spec: ProjectSpec = {
  name: "CheckIn", slug: "checkin", type: "plugin", targetId: "paper",
  minecraftVersion: "1.20.1", javaVersion: 17, buildTool: "gradle",
  packageName: "com.example.checkin", version: "1.0.0",
  description: "Daily check-in plugin", author: "test",
  features: { enableCommand: true, enableListener: true, enableConfig: true, enablePermissions: true }
};

describe("template-engine", () => {
  it("lists paper template", () => {
    const templates = listTemplates("paper");
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]?.id).toBe("plugin-paper-java");
  });

  it("derives paper-compatible targets from the target registry", () => {
    expect(listTemplates("purpur").some((t) => t.id === "plugin-paper-java")).toBe(true);
    expect(listTemplates("folia").some((t) => t.id === "plugin-paper-java")).toBe(true);
  });

  it("dry-run renders expected files", async () => {
    const files = await renderTemplate("plugin-paper-java", spec, "/tmp/fake", { dryRun: true });
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("build.gradle.kts");
    expect(paths).toContain("src/main/resources/plugin.yml");
    expect(paths).toContain("src/main/java/com/example/checkin/CheckIn.java");
  });

  it("plugin.yml contains correct main class", async () => {
    const files = await renderTemplate("plugin-paper-java", spec, "/tmp/fake", { dryRun: true });
    const yml = files.find((f) => f.relativePath.endsWith("plugin.yml"))!;
    expect(yml.content).toContain("com.example.checkin.CheckIn");
    expect(yml.content).toContain("name: CheckIn");
  });

  it("writes files to disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcfl-tpl-"));
    try {
      await renderTemplate("plugin-paper-java", spec, dir);
      expect(existsSync(join(dir, "build.gradle.kts"))).toBe(true);
      expect(existsSync(join(dir, "src/main/resources/plugin.yml"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("throws on unknown template", async () => {
    await expect(renderTemplate("unknown-tpl", spec, "/tmp", { dryRun: true })).rejects.toThrow();
  });
});
