import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import { validatePatch } from "@mc-forgelab/file-operation";
import type { ProviderAdapter } from "@mc-forgelab/ai-provider-manager";
import type { AutoFixContext, AutoFixResult } from "./types.js";
import type { FilePatch } from "@mc-forgelab/file-operation";

const FIX_SYSTEM_PROMPT = `You are a Minecraft plugin/mod build error fixer. Given a build error analysis and relevant source files, generate a FilePatch to fix the errors.
Return ONLY valid JSON matching the FilePatch schema. No markdown, no explanation outside JSON.`;

export async function generateFix(adapter: ProviderAdapter, ctx: AutoFixContext): Promise<AutoFixResult> {
  const prevSummary = ctx.previousAttempts.map((a) => `Round ${a.round}: ${a.summary}`).join("\n");
  const filesContext = Object.entries(ctx.relevantFiles)
    .map(([p, c]) => `// ${p}\n${c.slice(0, 3000)}`)
    .join("\n\n");

  const schema = {
    type: "object",
    required: ["type", "summary", "operations"],
    properties: {
      type: { const: "file_patch" },
      summary: { type: "string" },
      operations: {
        type: "array",
        items: {
          type: "object",
          required: ["op", "path"],
          properties: {
            op: { enum: ["create", "update", "delete", "move"] },
            path: { type: "string" },
            content: { type: "string" },
            newPath: { type: "string" },
          },
        },
      },
    },
  };

  const patch = await adapter.generateJson<FilePatch>({
    messages: [
      { role: "system", content: FIX_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `## Error Analysis (Round ${ctx.round}/${ctx.maxRounds})`,
          `Summary: ${ctx.errorAnalysis.summary}`,
          `Likely cause: ${ctx.errorAnalysis.likelyCause ?? "unknown"}`,
          `Compressed log:\n${ctx.errorAnalysis.compressedLog}`,
          prevSummary ? `## Previous attempts:\n${prevSummary}` : "",
          `## Relevant files:\n${filesContext}`,
          `## Generate FilePatch JSON to fix these errors:`,
        ].filter(Boolean).join("\n\n"),
      },
    ],
    temperature: 0.1,
    schema,
  });

  const validation = validatePatch(patch, ctx.workspaceRoot);
  if (!validation.valid) {
    throw new AppError(ErrorCode.FILE_OP_PATCH_INVALID, { details: { errors: validation.errors } });
  }

  const confidence: AutoFixResult["confidence"] =
    ctx.errorAnalysis.findings.length === 0 ? "low"
    : ctx.errorAnalysis.suggestedFocusFiles.length > 0 ? "high"
    : "medium";

  return { patch, confidence, rationale: ctx.errorAnalysis.likelyCause ?? "auto-fix", needsHumanReview: confidence === "low" };
}
