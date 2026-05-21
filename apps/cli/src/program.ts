import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerTargetCommands } from "./commands/target-list.js";
import { registerAICommands } from "./commands/ai.js";
import { registerToolchainCommands } from "./commands/toolchain.js";
import { registerCacheCommands } from "./commands/cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ProgramContext {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: NodeJS.Platform;
  readonly stdout: NodeJS.WriteStream;
  readonly stderr: NodeJS.WriteStream;
}

function readPackageVersion(env: Readonly<Record<string, string | undefined>>): string {
  try {
    const parsed = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.length > 0) return parsed.version;
  } catch {
    // Fall through to npm metadata for source-only test runners.
  }
  return env.npm_package_version ?? process.env.npm_package_version ?? "0.0.0";
}

export function buildProgram(ctx: ProgramContext): Command {
  const program = new Command();
  program
    .name("mcforgelab")
    .description("MC-ForgeLab CLI: Minecraft 插件/模组项目生成-编译-打包平台")
    .version(readPackageVersion(ctx.env), "-v, --version", "显示版本号 / show version")
    .exitOverride();

  registerDoctorCommand(program, ctx);
  registerTargetCommands(program, ctx);
  registerAICommands(program, ctx);
  registerToolchainCommands(program, ctx);
  registerCacheCommands(program, ctx);

  return program;
}
