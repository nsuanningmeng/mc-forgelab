import { describe, it, expect } from "vitest";
import { buildProgram } from "./program.js";

const baseCtx = {
  env: {},
  platform: process.platform,
  stdout: process.stdout,
  stderr: process.stderr
};

describe("cli program", () => {
  it("registers expected commands", () => {
    const p = buildProgram(baseCtx);
    const names = p.commands.map((c) => c.name());
    expect(names).toContain("doctor");
    expect(names).toContain("target");
  });

  it("target sub-command has list and show", () => {
    const p = buildProgram(baseCtx);
    const target = p.commands.find((c) => c.name() === "target")!;
    const subNames = target.commands.map((c) => c.name());
    expect(subNames).toContain("list");
    expect(subNames).toContain("show");
  });

  it("doctor accepts --json flag", async () => {
    const p = buildProgram(baseCtx);
    const doctor = p.commands.find((c) => c.name() === "doctor")!;
    const opts = doctor.options.map((o) => o.long);
    expect(opts).toContain("--json");
  });
});
