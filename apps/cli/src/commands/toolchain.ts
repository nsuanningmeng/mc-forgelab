import type { Command } from "commander";
import pc from "picocolors";
import { doctor, downloadJdk } from "@mc-forgelab/toolchain-manager";
import type { ProgramContext } from "../program.js";

export function registerToolchainCommands(program: Command, ctx: ProgramContext): void {
  const tc = program.command("toolchain").description("工具链管理 / toolchain management");

  tc.command("list")
    .description("列出工具链状态 / list toolchain status")
    .action(async () => {
      const statuses = await doctor();
      if (statuses.length === 0) {
        ctx.stdout.write(pc.yellow("未检测到托管工具链，将使用系统 Java/Gradle。\n"));
        return;
      }
      for (const s of statuses) {
        const icon = s.installed ? pc.green("✓") : pc.red("✗");
        ctx.stdout.write(`${icon} ${s.toolName} ${s.version ?? "(未安装)"}\n`);
        for (const issue of s.issues) ctx.stdout.write(`  ${pc.yellow("!")} ${issue}\n`);
      }
    });

  tc.command("verify")
    .description("验证工具链完整性 / verify toolchain integrity")
    .action(async () => {
      ctx.stdout.write(pc.cyan("验证工具链...\n"));
      const statuses = await doctor();
      const ok = statuses.every(s => s.installed);
      ctx.stdout.write(ok ? pc.green("所有工具链正常。\n") : pc.yellow("部分工具链缺失，请检查上方输出。\n"));
    });

  tc.command("install")
    .description("下载并安装 JDK / download and install JDK")
    .requiredOption("--version <version>", "JDK version (8, 11, 17, 21)")
    .action(async (opts: { version: string }) => {
      const version = Number(opts.version) as 8 | 11 | 17 | 21;
      if (![8, 11, 17, 21].includes(version)) {
        ctx.stderr.write(pc.red("版本必须是 8, 11, 17 或 21\n"));
        process.exit(1);
      }
      ctx.stdout.write(pc.cyan(`正在下载 JDK ${version}...\n`));
      try {
        const tool = await downloadJdk(version, {
          onProgress: (msg) => ctx.stdout.write(`  ${msg}\n`),
        });
        ctx.stdout.write(pc.green(`✓ JDK ${version} 已安装: ${tool.executable}\n`));
      } catch (e) {
        ctx.stderr.write(pc.red(`安装失败: ${(e as Error).message}\n`));
        process.exit(1);
      }
    });
}
