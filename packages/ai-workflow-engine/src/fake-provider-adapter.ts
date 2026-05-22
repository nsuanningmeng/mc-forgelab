import type { StepRole } from "./types.js";

export interface FakeProviderResponse {
  readonly text: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface FakeProviderAdapter {
  invoke(role: StepRole, prompt: string, context: Record<string, string>): Promise<FakeProviderResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseText(role: StepRole): string {
  switch (role) {
    case "requirement_analyst":
      return [
        "# Requirement Spec",
        "",
        "Build a deterministic Minecraft plugin workspace that can be generated, patched, built, and packaged without external model calls.",
        "",
        "## Acceptance Criteria",
        "- Generate a minimal plugin entry point.",
        "- Include plugin metadata and Gradle build files.",
        "- Produce a final run summary."
      ].join("\n");
    case "architect":
      return [
        "# Project Plan",
        "",
        "## Files",
        "- src/main/java/com/example/Main.java",
        "- src/main/resources/plugin.yml",
        "- build.gradle.kts",
        "",
        "## Steps",
        "1. Create a Java plugin main class.",
        "2. Add plugin metadata.",
        "3. Configure Gradle for a Paper plugin build."
      ].join("\n");
    case "code_generator":
      return JSON.stringify({
        files: [
          {
            path: "src/main/java/com/example/Main.java",
            content: "package com.example;\n\npublic final class Main {\n  public String name() {\n    return \"MC-AI-ForgeLab\";\n  }\n}\n"
          },
          {
            path: "src/main/resources/plugin.yml",
            content: "name: ForgeLabGenerated\nversion: 0.3.0\nmain: com.example.Main\napi-version: '1.20'\n"
          },
          {
            path: "build.gradle.kts",
            content: "plugins { java }\n\ngroup = \"com.example\"\nversion = \"0.3.0\"\n"
          }
        ]
      });
    case "build_error_analyzer":
      return "The fake build log indicates no actionable compiler errors in v0.3.0 runtime validation.";
    case "auto_fixer":
      return JSON.stringify({
        type: "file_patch",
        summary: "Fake auto-fix patch for runtime validation.",
        operations: [
          {
            op: "update",
            path: "src/main/java/com/example/Main.java",
            content: "package com.example;\n\npublic final class Main {\n  public String name() {\n    return \"MC-AI-ForgeLab-Fixed\";\n  }\n}\n"
          }
        ]
      });
    case "documentation_writer":
      return "Generated documentation describes the plugin layout, build command, and produced artifact.";
    case "final_summarizer":
      return "The workflow completed successfully with generated project files, an applied patch, a passing build, and packaged artifacts.";
    case "code_reviewer":
      return "Review complete: the generated fake patch is deterministic and contains only expected project files.";
    default:
      return "Deterministic fake provider output for runtime validation.";
  }
}

export function createFakeProviderAdapter(): FakeProviderAdapter {
  return {
    async invoke(role, _prompt, _context) {
      await sleep(150);
      return {
        text: responseText(role),
        tokensIn: 100,
        tokensOut: 300
      };
    }
  };
}
