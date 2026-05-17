import type { Command } from "commander";
import { Command as CmdCtor } from "commander";
import Table from "cli-table3";
import pc from "picocolors";
import { loadConfig } from "@mc-forgelab/config";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";
import { CompatibilityEngine, builtinRules } from "@mc-forgelab/compatibility";
import type { ProgramContext } from "../program.js";

interface CheckLine {
  readonly name: string;
  readonly status: "ok" | "warn" | "miss" | "info";
  readonly detail: string;
}

export function registerDoctorCommand(program: Command, ctx: ProgramContext): void {
  const doctor = program
    .command("doctor")
    .description("环境与配置健康检查 / Environment and configuration health check")
    .option("--json", "输出 JSON / output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const lines = await collectChecks(ctx);
      if (opts.json) {
        ctx.stdout.write(`${JSON.stringify({ checks: lines }, null, 2)}\n`);
      } else {
        renderTable(lines, ctx.stdout);
      }
    });

  doctor
    .command("toolchains")
    .description("仅检查工具链 / check toolchains only")
    .action(() => {
      ctx.stdout.write(
        `${pc.yellow("⚠")} toolchain 检测在阶段 2 实现，当前显示占位结果。\n` +
          `   ${pc.dim("Toolchain detection lands in stage 2.")}\n`
      );
    });

  doctor
    .command("network")
    .description("网络连通性占位 / network connectivity placeholder")
    .action(() => {
      ctx.stdout.write(`${pc.yellow("⚠")} 网络连通性检查在阶段 2/7 实现。\n`);
    });

  // 让子命令在 commander v12 下正确触发解析
  void CmdCtor;
}

async function collectChecks(ctx: ProgramContext): Promise<CheckLine[]> {
  const lines: CheckLine[] = [];
  const env = ctx.env;

  // 系统信息
  lines.push({
    name: "操作系统 / OS",
    status: "ok",
    detail: `${process.platform} (${process.arch}) node ${process.version}`
  });

  // 配置
  try {
    const cfg = loadConfig({ env, mode: "cli" });
    lines.push({ name: "运行模式 / mode", status: "ok", detail: cfg.mode });
    lines.push({ name: "workspace 路径", status: "ok", detail: cfg.paths.workspace });
    lines.push({ name: "cache 路径", status: "ok", detail: cfg.paths.cache });
    lines.push({ name: "logs 路径", status: "ok", detail: cfg.paths.logs });
    lines.push({ name: "db 路径", status: "ok", detail: cfg.paths.db });
    lines.push({ name: "toolchains 路径", status: "ok", detail: cfg.paths.toolchains });
    lines.push({
      name: "构建并发数 / max build concurrency",
      status: "ok",
      detail: String(cfg.limits.maxBuildConcurrency)
    });
    lines.push({
      name: "认证 / auth",
      status: cfg.auth.enabled ? "ok" : "info",
      detail: cfg.auth.enabled ? "enabled" : "disabled (local mode)"
    });
  } catch (e) {
    lines.push({
      name: "配置加载 / config load",
      status: "miss",
      detail: e instanceof Error ? e.message : String(e)
    });
  }

  // 工具链（阶段 2 占位）
  lines.push({ name: "JDK", status: "miss", detail: "阶段 2 实现 / detected at stage 2" });
  lines.push({ name: "Gradle", status: "miss", detail: "阶段 2 实现 / detected at stage 2" });
  lines.push({ name: "Maven", status: "miss", detail: "阶段 2 实现 / detected at stage 2" });
  lines.push({ name: "Node runtime", status: "ok", detail: process.versions.node });
  lines.push({ name: "Docker", status: "info", detail: "阶段 7 集成 / integrated at stage 7" });

  // Registry / engine 版本
  const registry = createDefaultRegistry();
  const engine = new CompatibilityEngine(registry, builtinRules);
  lines.push({
    name: "target registry",
    status: "ok",
    detail: `v${registry.version} (${registry.list().length} 内置 target)`
  });
  lines.push({
    name: "compatibility registry",
    status: "ok",
    detail: `v${engine.version} (${builtinRules.length} 内置规则)`
  });

  return lines;
}

function renderTable(lines: ReadonlyArray<CheckLine>, stdout: NodeJS.WriteStream): void {
  const table = new Table({
    head: [pc.bold("项目"), pc.bold("状态"), pc.bold("详情")],
    colWidths: [28, 8, 60],
    wordWrap: true,
    style: { head: [], border: ["grey"] }
  });

  for (const line of lines) {
    table.push([line.name, statusLabel(line.status), line.detail]);
  }
  stdout.write(`${table.toString()}\n`);
}

function statusLabel(status: CheckLine["status"]): string {
  switch (status) {
    case "ok":
      return pc.green("OK");
    case "warn":
      return pc.yellow("WARN");
    case "miss":
      return pc.red("MISS");
    case "info":
      return pc.cyan("INFO");
  }
}
