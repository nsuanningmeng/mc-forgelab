import { describe, it, expect } from "vitest";
import { openStorage, BASE_MIGRATIONS } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS } from "@mc-forgelab/ai-provider-manager";
import { BUILTIN_WORKFLOWS, createWorkflowEngine, createWorkflowRuntime, STAGE3_MIGRATIONS, type RuntimeEvent } from "./index.js";

async function makeRuntime() {
  const storage = await openStorage({ backend: "memory", migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS] });
  const engine = createWorkflowEngine(storage);
  engine.seedBuiltins();
  const runtime = createWorkflowRuntime({ storage, engine, workflows: BUILTIN_WORKFLOWS });
  return { storage, engine, runtime };
}

function waitForEvent(events: RuntimeEvent[], predicate: (event: RuntimeEvent) => boolean, timeoutMs = 3000): Promise<RuntimeEvent> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const found = events.find(predicate);
      if (found) {
        resolve(found);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Timed out waiting for runtime event"));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe("WorkflowRuntime", () => {
  it("finishes simple-single-model successfully", async () => {
    const { engine, runtime } = await makeRuntime();
    const started = await runtime.startRun({ workflowId: "simple-single-model", userPrompt: "Create a simple plugin" });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "success");
    expect(engine.getRun(started.runId).status).toBe("success");
  });

  it("pauses for patch review and resumes after approval", async () => {
    const { engine, runtime } = await makeRuntime();
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      userPrompt: "Create a plugin with review",
      patchReviewEnabled: true
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    const pending = await waitForEvent(events, (event) => event.type === "patch_pending");
    expect(pending.type).toBe("patch_pending");
    expect(engine.getRun(started.runId).status).toBe("waiting_confirmation" as never);

    await runtime.confirmPatch(started.runId, "approve");
    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "success");
    expect(engine.getRun(started.runId).status).toBe("success");
  });

  it("cancels a running workflow", async () => {
    const { engine, runtime } = await makeRuntime();
    const started = await runtime.startRun({ workflowId: "simple-single-model", userPrompt: "Create a plugin then cancel" });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    await waitForEvent(events, (event) => event.type === "step_started");
    const canceled = await runtime.cancelRun(started.runId);
    expect(canceled).toBe(true);

    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "canceled");
    expect(engine.getRun(started.runId).status).toBe("canceled");
  });

  it("retries from a step in a new run", async () => {
    const { storage, runtime } = await makeRuntime();
    const started = await runtime.startRun({ workflowId: "simple-single-model", userPrompt: "Create a plugin then retry" });
    const firstEvents: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => firstEvents.push(event));
    await waitForEvent(firstEvents, (event) => event.type === "run_finished" && event.status === "success");

    const retried = await runtime.retryRunFromStep(started.runId, "generate");
    const retryEvents: RuntimeEvent[] = [];
    runtime.subscribe(retried.runId, (event) => retryEvents.push(event));
    await waitForEvent(retryEvents, (event) => event.type === "run_finished" && event.status === "success");

    const retryRow = storage.backend.get<{ parent_run_id: string | null; retry_of_run_id: string | null }>(
      "SELECT parent_run_id, retry_of_run_id FROM ai_workflow_runs WHERE id = ?",
      [retried.runId]
    );
    expect(retryRow?.parent_run_id).toBe(started.runId);
    expect(retryRow?.retry_of_run_id).toBe(started.runId);
  });

  it("unsubscribe stops listener delivery", async () => {
    const { runtime } = await makeRuntime();
    const started = await runtime.startRun({ workflowId: "simple-single-model", userPrompt: "Create a plugin" });
    let count = 0;
    const unsubscribe = runtime.subscribe(started.runId, () => {
      count += 1;
    });
    unsubscribe();

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(count).toBe(0);
  });
});
