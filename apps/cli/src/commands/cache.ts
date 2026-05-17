import type { Command } from "commander";
import pc from "picocolors";
import { statSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "@mc-forgelab/config";
import type { ProgramContext } from "../program.js";

function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    try { total += f.isDirectory() ? dirSize(p) : statSync(p).size; } catch { /* skip */ }
  }
  return total;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function registerCacheCommands(program: Command, ctx: ProgramContext): void {
  const cache = program.command("cache").description("缓存管理 / cache management");

  cache.command("status")
    .description("显示缓存占用 / show cache usage")
    .action(() => {
      const cfg = loadConfig({ env: ctx.env, mode: "cli" });
      const cacheSize = dirSize(cfg.paths.cache);
      const artifactsSize = dirSize(cfg.paths.artifacts);
      ctx.stdout.write(`cache:     ${fmt(cacheSize)}  (${cfg.paths.cache})\n`);
      ctx.stdout.write(`artifacts: ${fmt(artifactsSize)}  (${cfg.paths.artifacts})\n`);
    });

  cache.command("clean")
    .description("清理缓存 / clean cache")
    .option("--dry-run", "仅预览，不删除 / preview only", false)
    .action((opts: { dryRun: boolean }) => {
      const cfg = loadConfig({ env: ctx.env, mode: "cli" });
      if (opts.dryRun) {
        ctx.stdout.write(pc.yellow(`[dry-run] 将清理: ${cfg.paths.cache}\n`));
      } else {
        ctx.stdout.write(pc.yellow("缓存清理功能将在阶段12实现。\n"));
      }
    });
}
