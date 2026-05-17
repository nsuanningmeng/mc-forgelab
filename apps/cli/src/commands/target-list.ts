import type { Command } from "commander";
import Table from "cli-table3";
import pc from "picocolors";
import { createDefaultRegistry, type Target, type TargetType } from "@mc-forgelab/target-registry";
import type { ProgramContext } from "../program.js";

export function registerTargetCommands(program: Command, ctx: ProgramContext): void {
  const target = program.command("target").description("目标端管理 / target management");

  target
    .command("list")
    .description("列出内置目标端 / list builtin targets")
    .option("--json", "输出 JSON / output JSON", false)
    .option("--type <type>", "按类型过滤 (plugin/mod/proxy/hybrid)")
    .option("--all", "包含 legacy / deprecated 目标", false)
    .action((opts: { json?: boolean; type?: string; all?: boolean }) => {
      const registry = createDefaultRegistry();
      const filter = buildFilter(opts);
      const items = registry.list(filter);

      if (opts.json) {
        ctx.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
        return;
      }
      renderTable(items, ctx.stdout);
    });

  target
    .command("show <id>")
    .description("查看单个目标端详情 / show one target")
    .option("--json", "输出 JSON", false)
    .action((id: string, opts: { json?: boolean }) => {
      const registry = createDefaultRegistry();
      const t = registry.get(id);
      if (opts.json) {
        ctx.stdout.write(`${JSON.stringify(t, null, 2)}\n`);
        return;
      }
      renderDetail(t, ctx.stdout);
    });
}

function buildFilter(opts: { type?: string; all?: boolean }): {
  type?: TargetType;
  includeLegacy?: boolean;
  includeDeprecated?: boolean;
} {
  const valid: ReadonlyArray<TargetType> = ["plugin", "mod", "proxy", "hybrid"];
  const filter: { type?: TargetType; includeLegacy?: boolean; includeDeprecated?: boolean } = {
    includeLegacy: opts.all,
    includeDeprecated: opts.all
  };
  if (opts.type && (valid as readonly string[]).includes(opts.type)) {
    filter.type = opts.type as TargetType;
  }
  return filter;
}

function renderTable(items: ReadonlyArray<Target>, stdout: NodeJS.WriteStream): void {
  const table = new Table({
    head: [pc.bold("ID"), pc.bold("名称"), pc.bold("类型"), pc.bold("稳定性"), pc.bold("构建工具"), pc.bold("模板")],
    colWidths: [12, 14, 10, 14, 12, 30],
    style: { head: [], border: ["grey"] }
  });
  for (const t of items) {
    table.push([
      t.id,
      t.displayName,
      t.type,
      stabilityLabel(t.stability),
      t.recommendedBuildTool,
      t.templateIds.join(", ")
    ]);
  }
  stdout.write(`${table.toString()}\n`);
}

function renderDetail(t: Target, stdout: NodeJS.WriteStream): void {
  stdout.write(`${pc.bold(t.displayName)} (${t.id}) — ${t.type} / ${t.stability}\n`);
  stdout.write(`${pc.dim("docs:")} ${t.docsUrl}\n`);
  stdout.write(`${pc.dim("templates:")} ${t.templateIds.join(", ")}\n`);
  stdout.write(`${pc.dim("build tool:")} ${t.recommendedBuildTool}\n`);
  if (t.versionConstraints.length > 0) {
    stdout.write(`${pc.dim("version constraints:")}\n`);
    for (const c of t.versionConstraints) {
      stdout.write(
        `  MC ${c.minecraftRange}  Java ${c.supportedJava.join("/")} (推荐 ${c.recommendedJava})  Gradle ${c.recommendedGradle ?? "—"}\n`
      );
    }
  }
  if (t.warningsZh.length > 0) {
    stdout.write(`${pc.dim("warnings:")}\n`);
    for (const w of t.warningsZh) stdout.write(`  ${pc.yellow("⚠")} ${w}\n`);
  }
  const flags: string[] = [];
  if (t.experimental) flags.push("experimental");
  if (t.legacy) flags.push("legacy");
  if (t.deprecated) flags.push("deprecated");
  if (flags.length > 0) {
    stdout.write(`${pc.dim("flags:")} ${flags.join(", ")}\n`);
  }
}

function stabilityLabel(s: Target["stability"]): string {
  switch (s) {
    case "stable":
      return pc.green("stable");
    case "experimental":
      return pc.yellow("experimental");
    case "legacy":
      return pc.gray("legacy");
    case "deprecated":
      return pc.red("deprecated");
  }
}
