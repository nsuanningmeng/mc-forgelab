import type { ProviderAdapter } from "@mc-forgelab/ai-provider-manager";
import type { RequirementSpec, ProjectPlan } from "./types.js";

const REQUIREMENT_SYSTEM_PROMPT = `You are a Minecraft plugin/mod development expert. Analyze the user's natural language requirement and extract structured information.
Respond with valid JSON only, no markdown.`;

const PLAN_SYSTEM_PROMPT = `You are a Minecraft plugin/mod architect. Generate a detailed development plan based on the requirement spec.
Respond with valid JSON only, no markdown.`;

export async function analyzeRequirement(adapter: ProviderAdapter, userPrompt: string): Promise<RequirementSpec> {
  const schema = {
    type: "object",
    properties: {
      taskType: { type: "string", enum: ["create", "modify", "fix", "explain", "refactor", "generate-docs"] },
      projectType: { type: "string", enum: ["plugin", "mod", "hybrid", "proxy"] },
      targetId: { type: "string" },
      minecraftVersion: { type: "string" },
      features: { type: "array", items: { type: "string" } },
      needsDatabase: { type: "boolean" },
      needsPermissions: { type: "boolean" },
      needsThirdPartyApis: { type: "array", items: { type: "string" } },
      needsClientSide: { type: "boolean" },
      needsHybrid: { type: "boolean" }
    }
  };

  const result = await adapter.generateJson<Omit<RequirementSpec, "rawPrompt">>({
    messages: [
      { role: "system", content: REQUIREMENT_SYSTEM_PROMPT },
      { role: "user", content: `Analyze this Minecraft development request and return JSON:\n\n${userPrompt}` }
    ],
    temperature: 0.1,
    schema
  });

  return {
    ...result,
    targetId: result.targetId || "paper",
    minecraftVersion: result.minecraftVersion || "1.20.1",
    features: result.features || [],
    needsThirdPartyApis: result.needsThirdPartyApis || [],
    rawPrompt: userPrompt
  };
}

export async function planProject(adapter: ProviderAdapter, spec: RequirementSpec): Promise<ProjectPlan> {
  const schema = {
    type: "object",
    properties: {
      projectName: { type: "string" },
      packageName: { type: "string" },
      mainClass: { type: "string" },
      targetId: { type: "string" },
      minecraftVersion: { type: "string" },
      javaVersion: { type: "number" },
      buildTool: { type: "string" },
      filesToGenerate: { type: "array", items: { type: "string" } },
      commands: { type: "array", items: { type: "string" } },
      listeners: { type: "array", items: { type: "string" } },
      configKeys: { type: "array", items: { type: "string" } },
      permissions: { type: "array", items: { type: "string" } },
      storageType: { type: "string" },
      thirdPartyDeps: { type: "array", items: { type: "string" } },
      compatibilityWarnings: { type: "array", items: { type: "string" } },
      description: { type: "string" }
    }
  };

  const result = await adapter.generateJson<ProjectPlan>({
    messages: [
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: `Generate a project plan for this requirement:\n${JSON.stringify(spec, null, 2)}` }
    ],
    temperature: 0.1,
    schema
  });

  return {
    ...result,
    targetId: result.targetId || spec.targetId,
    minecraftVersion: result.minecraftVersion || spec.minecraftVersion,
    javaVersion: result.javaVersion || 17,
    buildTool: result.buildTool || "gradle-kotlin",
    filesToGenerate: result.filesToGenerate || [],
    commands: result.commands || [],
    listeners: result.listeners || [],
    configKeys: result.configKeys || [],
    permissions: result.permissions || [],
    storageType: result.storageType || "none",
    thirdPartyDeps: result.thirdPartyDeps || [],
    compatibilityWarnings: result.compatibilityWarnings || []
  };
}
