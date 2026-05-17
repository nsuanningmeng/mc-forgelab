import { Command } from "commander";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerTargetCommands } from "./commands/target-list.js";

export interface ProgramContext {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: NodeJS.Platform;
  readonly stdout: NodeJS.WriteStream;
  readonly stderr: NodeJS.WriteStream;
}

export function buildProgram(ctx: ProgramContext): Command {
  const program = new Command();
  program
    .name("mcforgelab")
    .description("MC-ForgeLab CLI: Minecraft 插件/模组项目生成-编译-打包平台")
    .version("0.1.0", "-v, --version", "显示版本号 / show version")
    .exitOverride();

  registerDoctorCommand(program, ctx);
  registerTargetCommands(program, ctx);

  return program;
}
