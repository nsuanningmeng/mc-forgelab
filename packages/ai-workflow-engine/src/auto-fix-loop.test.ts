import { describe, expect, it, vi } from "vitest";
import {
  STAGE2_MIGRATIONS,
  type ChatOptions,
  type ConnectionTestResult,
  type ModelInfo,
  type ModelProfileRecord,
  type ModelRole,
  type ProviderAdapter,
  type ProviderManager,
  type ProviderRecord,
  type StreamChunk
} from "@mc-forgelab/ai-provider-manager";
import { BASE_MIGRATIONS, openStorage, type Storage } from "@mc-forgelab/storage";
import {
  BUILTIN_WORKFLOWS,
  createWorkflowEngine,
  createWorkflowRuntime,
  STAGE3_MIGRATIONS,
  type BuildRunner,
  type PatchApplier,
  type RuntimeConfig,
  type RuntimeEvent,
  type WorkflowBuildResult,
  type WorkflowDefinition
} from "./index.js";

const PROJECT_ID = "test-project";

const FAILED_BUILD: WorkflowBuildResult = {
  status: "failed",
  log: "Build failed",
  errorCode: "BUILD_FAILED",
  errorSummary: "Compilation error"
};

const SUCCESS_BUILD: WorkflowBuildResult = {
  status: "success",
  log: "Build completed"
};

type StepFinishedEvent = Extract<RuntimeEvent, { type: "step_finished" }>;
type RunFinishedEvent = Extract<RuntimeEvent, { type: "run_finished" }>;

interface MakeRuntimeOptions {
  readonly buildRunner?: BuildRunner;
  readonly patchApplier?: PatchApplier;
  readonly config?: Partial<RuntimeConfig>;
  readonly providers?: ProviderManager;
  readonly workflows?: readonly WorkflowDefinition[];
}

async function makeRuntime(options: MakeRuntimeOptions = {}) {
  const storage = await openStorage({
    backend: "memory",
    migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS]
  });
  seedProject(storage);

  const engine = createWorkflowEngine(storage);
  engine.seedBuiltins();

  const runtime = createWorkflowRuntime({
    storage,
    engine,
    workflows: options.workflows ?? BUILTIN_WORKFLOWS,
    providers: options.providers,
    config: {
      workspaceRoot: process.cwd(),
      ...options.config
    },
    buildRunner: options.buildRunner,
    patchApplier: options.patchApplier
  });

  return { storage, engine, runtime };
}

function seedProject(storage: Storage): void {
  const now = new Date().toISOString();
  storage.backend.run(
    `INSERT INTO projects (
      id, name, slug, type, target_id, minecraft_version, java_version,
      build_tool, package_name, main_class, project_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      PROJECT_ID,
      "Test Project",
      "test-project",
      "paper-plugin",
      "paper",
      "1.20.4",
      17,
      "gradle",
      "com.example",
      "com.example.Main",
      "projects/test-project",
      now,
      now
    ]
  );
}

function waitForEvent(events: RuntimeEvent[], predicate: (event: RuntimeEvent) => boolean, timeoutMs = 5000): Promise<RuntimeEvent> {
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

function workflowsWithFixLoopMaxRounds(maxRounds: number): readonly WorkflowDefinition[] {
  return BUILTIN_WORKFLOWS.map((workflow) => {
    if (workflow.id !== "simple-single-model") return workflow;
    return {
      ...workflow,
      steps: workflow.steps.map((step) => step.id === "fix_loop" ? { ...step, maxRounds } : step)
    };
  });
}

function createPatchApplier(): PatchApplier {
  return {
    apply: vi.fn<PatchApplier["apply"]>().mockResolvedValue({ applied: 1, errors: [] })
  };
}

function createCapturingProviderManager(capturedPrompts: string[]): ProviderManager {
  const adapter: ProviderAdapter = {
    async listModels(): Promise<ModelInfo[]> {
      return [];
    },
    async chat(opts: ChatOptions) {
      const prompt = opts.messages.map((message) => message.content).join("\n\n");
      capturedPrompts.push(prompt);
      return {
        content: responseTextForPrompt(prompt),
        model: opts.model ?? "test-model",
        inputTokens: 1,
        outputTokens: 1,
        finishReason: "stop"
      };
    },
    async *streamChat(): AsyncIterable<StreamChunk> {
      yield { delta: "", done: true };
    },
    async generateJson<T>(): Promise<T> {
      return {} as T;
    },
    async testConnection(): Promise<ConnectionTestResult> {
      return { ok: true, latencyMs: 1, model: "test-model", errorCode: null, errorMessage: null };
    },
    estimateTokens(text: string): number {
      return text.length;
    },
    getCapabilities() {
      return {
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsJsonMode: false,
        supportsLongContext: false,
        supportsVision: false,
        supportsReasoning: false,
        maxContextTokens: null,
        maxOutputTokens: null
      };
    }
  };

  const provider: ProviderRecord = {
    id: "test-provider",
    displayName: "Test Provider",
    type: "openai-compatible",
    baseUrl: "https://example.invalid",
    apiKeyEncrypted: "encrypted",
    defaultModel: "test-model",
    availableModels: ["test-model"],
    customHeaders: {},
    customQueryParams: {},
    timeoutMs: 1000,
    maxRetries: 0,
    proxyUrl: null,
    enableStreaming: false,
    enableToolCalling: false,
    enableJsonMode: false,
    enableVision: false,
    enabled: true,
    createdAt: "",
    updatedAt: ""
  };

  return {
    listProviders: () => [provider],
    getProvider: () => provider,
    createProvider: () => provider,
    updateProvider: () => provider,
    deleteProvider: () => undefined,
    testProvider: () => adapter.testConnection(),
    listModels: () => adapter.listModels(),
    getAdapter: () => adapter,
    getAdapterForProfile: () => adapter,
    listProfiles: () => [],
    getProfile: (id: string) => makeProfile(id as ModelRole),
    getProfileByRole: (role: ModelRole) => makeProfile(role),
    createProfile: (input) => makeProfile(input.role),
    updateProfile: (id: string) => makeProfile(id as ModelRole),
    deleteProfile: () => undefined,
    ensureDefaultProfiles: () => undefined
  };
}

function makeProfile(role: ModelRole): ModelProfileRecord {
  return {
    id: `profile-${role}`,
    name: `${role} profile`,
    providerId: "test-provider",
    model: "test-model",
    role,
    temperature: 0.2,
    maxTokens: 4096,
    topP: 1,
    timeoutMs: 1000,
    systemPrompt: null,
    enabled: true,
    createdAt: "",
    updatedAt: ""
  };
}

function responseTextForPrompt(prompt: string): string {
  if (prompt.includes("Workflow role: code_generator")) {
    return JSON.stringify({
      type: "file_patch",
      summary: "Generated plugin files",
      operations: [
        {
          op: "create",
          path: "src/main/java/com/example/Main.java",
          content: "package com.example;\n\npublic final class Main {}\n"
        }
      ]
    });
  }
  if (prompt.includes("Workflow role: build_error_analyzer")) {
    return JSON.stringify({ summary: "Compilation error", errorCode: "BUILD_FAILED", likelyCause: "Missing import", evidence: ["cannot find symbol"], suggestedFocusFiles: ["src/main/java/com/example/Main.java"], recommendedFix: "Add missing import" });
  }
  if (prompt.includes("Workflow role: auto_fixer")) {
    return JSON.stringify({
      type: "file_patch",
      summary: "Auto-fix patch",
      operations: [
        {
          op: "update",
          path: "src/main/java/com/example/Main.java",
          content: "package com.example;\n\npublic final class Main {\n  public String name() { return \"fixed\"; }\n}\n"
        }
      ]
    });
  }
  if (prompt.includes("Workflow role: final_summarizer")) {
    return "Captured summary.";
  }
  return "Captured model output.";
}

describe("executeAutoFixLoop", () => {
  it("succeeds after one auto-fix round when rebuild passes", async () => {
    const runBuild = vi.fn<BuildRunner["run"]>()
      .mockResolvedValueOnce(FAILED_BUILD)
      .mockResolvedValueOnce(SUCCESS_BUILD);
    const { engine, runtime } = await makeRuntime({
      buildRunner: { run: runBuild },
      patchApplier: createPatchApplier()
    });
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      projectId: PROJECT_ID,
      userPrompt: "Create a plugin with one build fix"
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "success");

    const fixLoopFinished = events.find(
      (event): event is StepFinishedEvent => event.type === "step_finished" && event.stepId === "fix_loop"
    );
    expect(engine.getRun(started.runId).status).toBe("success");
    expect(fixLoopFinished?.status).toBe("success");
    expect(fixLoopFinished?.outputSummary).toContain("1 round(s)");
    expect(runBuild).toHaveBeenCalledTimes(2);
  });

  it("fails after reaching the configured auto-fix round limit", async () => {
    const runBuild = vi.fn<BuildRunner["run"]>().mockResolvedValue(FAILED_BUILD);
    const { engine, runtime } = await makeRuntime({
      workflows: workflowsWithFixLoopMaxRounds(2),
      buildRunner: { run: runBuild },
      patchApplier: createPatchApplier()
    });
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      projectId: PROJECT_ID,
      userPrompt: "Create a plugin that keeps failing"
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    const fixLoopFinished = await waitForEvent(
      events,
      (event) => event.type === "step_finished" && event.stepId === "fix_loop" && event.status === "failed"
    ) as StepFinishedEvent;
    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "failed");

    expect(engine.getRun(started.runId).status).toBe("failed");
    expect(fixLoopFinished.outputSummary).toContain("2 round(s)");
    expect(runBuild).toHaveBeenCalledTimes(3);
  });

  it("cancels while the auto-fix loop is running", async () => {
    const runBuild = vi.fn<BuildRunner["run"]>().mockResolvedValue(FAILED_BUILD);
    const { engine, runtime } = await makeRuntime({
      buildRunner: { run: runBuild },
      patchApplier: createPatchApplier()
    });
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      projectId: PROJECT_ID,
      userPrompt: "Create a plugin then cancel during auto-fix"
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    await waitForEvent(events, (event) => event.type === "step_log" && event.line.includes("Auto-fix round 1/5 started."));
    const canceled = await runtime.cancelRun(started.runId);
    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "canceled");

    expect(canceled).toBe(true);
    expect(engine.getRun(started.runId).status).toBe("canceled");
  });

  it("fails when the auto-fix token budget is exceeded", async () => {
    const runBuild = vi.fn<BuildRunner["run"]>().mockResolvedValue(FAILED_BUILD);
    const { engine, runtime } = await makeRuntime({
      config: { maxAutoFixTokens: 10 },
      buildRunner: { run: runBuild },
      patchApplier: createPatchApplier()
    });
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      projectId: PROJECT_ID,
      userPrompt: "Create a plugin with a tiny token budget"
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    const fixLoopFinished = await waitForEvent(
      events,
      (event) => event.type === "step_finished" && event.stepId === "fix_loop" && event.status === "failed"
    ) as StepFinishedEvent;
    const runFinished = await waitForEvent(
      events,
      (event) => event.type === "run_finished" && event.status === "failed"
    ) as RunFinishedEvent;

    expect(engine.getRun(started.runId).status).toBe("failed");
    expect(fixLoopFinished.outputSummary).toContain("Auto-fix token budget exceeded");
    expect(runFinished.errorMessage).toContain("Auto-fix token budget exceeded");
    expect(runBuild).toHaveBeenCalledTimes(1);
  });

  it("passes patch apply failure context into the next auto-fix round", async () => {
    const capturedPrompts: string[] = [];
    const runBuild = vi.fn<BuildRunner["run"]>()
      .mockResolvedValueOnce(FAILED_BUILD)
      .mockResolvedValueOnce(SUCCESS_BUILD);
    const applyPatch = vi.fn<PatchApplier["apply"]>()
      .mockResolvedValueOnce({ applied: 1, errors: [] })
      .mockRejectedValueOnce(new Error("patch exploded"))
      .mockResolvedValueOnce({ applied: 1, errors: [] });
    const { engine, runtime } = await makeRuntime({
      workflows: workflowsWithFixLoopMaxRounds(2),
      providers: createCapturingProviderManager(capturedPrompts),
      buildRunner: { run: runBuild },
      patchApplier: { apply: applyPatch }
    });
    const started = await runtime.startRun({
      workflowId: "simple-single-model",
      projectId: PROJECT_ID,
      userPrompt: "Create a plugin that needs a second patch"
    });
    const events: RuntimeEvent[] = [];
    runtime.subscribe(started.runId, (event) => events.push(event));

    await waitForEvent(events, (event) => event.type === "run_finished" && event.status === "success");

    const fixLoopFinished = events.find(
      (event): event is StepFinishedEvent => event.type === "step_finished" && event.stepId === "fix_loop"
    );
    expect(engine.getRun(started.runId).status).toBe("success");
    expect(fixLoopFinished?.outputSummary).toContain("2 round(s)");
    expect(applyPatch).toHaveBeenCalledTimes(3);
    expect(capturedPrompts.some((prompt) => (
      prompt.includes("Workflow role: build_error_analyzer") &&
      prompt.includes("previousPatchFailure") &&
      prompt.includes("patch exploded")
    ))).toBe(true);
    expect(capturedPrompts.some((prompt) => (
      prompt.includes("Workflow role: auto_fixer") &&
      prompt.includes("previousPatchFailure") &&
      prompt.includes("patch exploded")
    ))).toBe(true);
  });
});
