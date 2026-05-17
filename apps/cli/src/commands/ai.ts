import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "@mc-forgelab/config";
import { openStorage, BASE_MIGRATIONS } from "@mc-forgelab/storage";
import { STAGE2_MIGRATIONS, createProviderManager } from "@mc-forgelab/ai-provider-manager";
import { STAGE3_MIGRATIONS, createWorkflowEngine } from "@mc-forgelab/ai-workflow-engine";
import type { ProgramContext } from "../program.js";

export function registerAICommands(program: Command, ctx: ProgramContext): void {
  const ai = program.command("ai").description("AI 辅助开发 / AI-assisted development");

  ai.command("providers")
    .description("列出 AI 服务商 / list AI providers")
    .command("list")
    .action(async () => {
      const cfg = loadConfig({ env: ctx.env, mode: "cli" });
      const storage = await openStorage({ backend: "auto", dbPath: cfg.paths.db, migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS] });
      const mgr = createProviderManager(storage);
      const providers = mgr.listProviders();
      if (providers.length === 0) {
        ctx.stdout.write(pc.yellow("暂无 AI 服务商，请通过 WebUI 添加。\n"));
      } else {
        for (const p of providers) {
          ctx.stdout.write(`${p.enabled ? pc.green("●") : pc.gray("○")} ${p.displayName} (${p.baseUrl}) model=${p.defaultModel}\n`);
        }
      }
      storage.close();
    });

  ai.command("workflows")
    .description("列出工作流 / list workflows")
    .command("list")
    .action(async () => {
      const cfg = loadConfig({ env: ctx.env, mode: "cli" });
      const storage = await openStorage({ backend: "auto", dbPath: cfg.paths.db, migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS, ...STAGE3_MIGRATIONS] });
      const engine = createWorkflowEngine(storage);
      engine.seedBuiltins();
      for (const wf of engine.listWorkflows()) {
        ctx.stdout.write(`${wf.builtin ? pc.cyan("[内置]") : pc.green("[自定义]")} ${wf.id} — ${wf.name}\n`);
      }
      storage.close();
    });

  ai.command("run")
    .description("运行 AI 工作流 / run AI workflow")
    .requiredOption("-p, --prompt <text>", "需求描述 / requirement prompt")
    .option("-w, --workflow <id>", "工作流 ID", "paper-plugin-standard")
    .action(async (opts: { prompt: string; workflow: string }) => {
      ctx.stdout.write(pc.cyan(`[AI] 工作流: ${opts.workflow}\n`));
      ctx.stdout.write(pc.cyan(`[AI] 需求: ${opts.prompt}\n`));
      ctx.stdout.write(pc.yellow("提示：完整 AI 生成需在 WebUI 中配置 AI 服务商后使用。\n"));
      ctx.stdout.write(pc.dim("Tip: Full AI generation requires an AI provider configured via WebUI.\n"));
    });
}
