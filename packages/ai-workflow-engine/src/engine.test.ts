import { describe, it, expect, beforeEach } from "vitest";
import { openStorage, BASE_MIGRATIONS } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS } from "@mc-forgelab/ai-provider-manager";
import { createWorkflowEngine, STAGE3_MIGRATIONS, BUILTIN_WORKFLOWS } from "./index.js";

async function makeEngine() {
  const storage = await openStorage({ backend: "memory", migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS] });
  const engine = createWorkflowEngine(storage);
  engine.seedBuiltins();
  return { engine, storage };
}

describe("WorkflowEngine", () => {
  it("seeds builtin workflows", async () => {
    const { engine } = await makeEngine();
    const wfs = engine.listWorkflows();
    expect(wfs.length).toBe(BUILTIN_WORKFLOWS.length);
    expect(wfs.every((w) => w.builtin)).toBe(true);
  });

  it("gets workflow by id", async () => {
    const { engine } = await makeEngine();
    const wf = engine.getWorkflow("paper-plugin-standard");
    expect(wf.name).toContain("Paper");
    expect(wf.mode).toBe("multi-model");
  });

  it("creates and tracks a run", async () => {
    const { engine } = await makeEngine();
    const run = engine.createRun("paper-plugin-standard", "帮我写一个签到插件");
    expect(run.status).toBe("pending");
    engine.updateRunStatus(run.id, "running");
    const updated = engine.getRun(run.id);
    expect(updated.status).toBe("running");
  });

  it("creates and updates steps", async () => {
    const { engine } = await makeEngine();
    const run = engine.createRun("paper-plugin-standard", "test");
    const step = engine.createStep(run.id, "analyze", "requirement_analyst", "plannerModel");
    expect(step.status).toBe("pending");
    engine.updateStepStatus(step.id, "success", { outputSummary: "done", inputTokens: 100, outputTokens: 200 });
    const steps = engine.listSteps(run.id);
    expect(steps[0].status).toBe("success");
    expect(steps[0].tokenUsageInput).toBe(100);
  });

  it("cannot delete builtin workflow", async () => {
    const { engine } = await makeEngine();
    expect(() => engine.deleteWorkflow("paper-plugin-standard")).toThrow();
  });

  it("can create custom workflow", async () => {
    const { engine } = await makeEngine();
    engine.createWorkflow({ id: "my-custom", name: "Custom", mode: "custom", description: "test", steps: [] });
    const wf = engine.getWorkflow("my-custom");
    expect(wf.builtin).toBe(false);
    engine.deleteWorkflow("my-custom");
    expect(() => engine.getWorkflow("my-custom")).toThrow();
  });
});
