import { describe, it, expect } from "vitest";
import { analyzeRequirement, planProject } from "./analyzer.js";
import type { ProviderAdapter, ChatOptions, ChatResult, StreamChunk, ModelInfo, ConnectionTestResult, ModelCapabilities } from "@mc-forgelab/ai-provider-manager";

function mockAdapter(jsonResponse: unknown): ProviderAdapter {
  return {
    async chat(opts: ChatOptions): Promise<ChatResult> {
      return { content: JSON.stringify(jsonResponse), model: "mock", inputTokens: 10, outputTokens: 20, finishReason: "stop" };
    },
    async *streamChat(): AsyncIterable<StreamChunk> { yield { delta: "", done: true }; },
    async generateJson<T>(): Promise<T> { return jsonResponse as T; },
    async listModels(): Promise<ModelInfo[]> { return []; },
    async testConnection(): Promise<ConnectionTestResult> { return { ok: true, latencyMs: 1, model: "mock", errorCode: null, errorMessage: null }; },
    estimateTokens(text: string): number { return Math.ceil(text.length / 4); },
    getCapabilities(): ModelCapabilities {
      return { supportsStreaming: true, supportsToolCalling: false, supportsJsonMode: true, supportsLongContext: false, supportsVision: false, supportsReasoning: false, maxContextTokens: null, maxOutputTokens: null };
    }
  };
}

describe("analyzeRequirement", () => {
  it("parses requirement from AI response", async () => {
    const mockSpec = {
      taskType: "create", projectType: "plugin", targetId: "paper",
      minecraftVersion: "1.20.1", features: ["checkin", "rewards"],
      needsDatabase: true, needsPermissions: true, needsThirdPartyApis: [],
      needsClientSide: false, needsHybrid: false
    };
    const adapter = mockAdapter(mockSpec);
    const spec = await analyzeRequirement(adapter, "帮我写一个 Paper 1.20.1 签到插件");
    expect(spec.taskType).toBe("create");
    expect(spec.targetId).toBe("paper");
    expect(spec.rawPrompt).toContain("签到");
  });
});

describe("planProject", () => {
  it("generates project plan", async () => {
    const mockPlan = {
      projectName: "CheckInPlugin", packageName: "com.example.checkin",
      mainClass: "com.example.checkin.CheckInPlugin", targetId: "paper",
      minecraftVersion: "1.20.1", javaVersion: 17, buildTool: "gradle-kotlin",
      filesToGenerate: ["build.gradle.kts", "src/main/java/com/example/checkin/CheckInPlugin.java"],
      commands: ["checkin"], listeners: ["PlayerJoinEvent"], configKeys: ["cooldown"],
      permissions: ["checkin.use"], storageType: "sqlite", thirdPartyDeps: [],
      compatibilityWarnings: [], description: "Daily check-in plugin"
    };
    const adapter = mockAdapter(mockPlan);
    const spec = { taskType: "create" as const, projectType: "plugin" as const, targetId: "paper", minecraftVersion: "1.20.1", features: ["checkin"], needsDatabase: true, needsPermissions: true, needsThirdPartyApis: [], needsClientSide: false, needsHybrid: false, rawPrompt: "test" };
    const plan = await planProject(adapter, spec);
    expect(plan.projectName).toBe("CheckInPlugin");
    expect(plan.javaVersion).toBe(17);
    expect(plan.commands).toContain("checkin");
  });
});
