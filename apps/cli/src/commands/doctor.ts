import { get as httpsGet } from "node:https";
import type { Command } from "commander";
import { Command as CmdCtor } from "commander";
import Table from "cli-table3";
import pc from "picocolors";
import { loadConfig } from "@mc-forgelab/config";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";
import { CompatibilityEngine, builtinRules } from "@mc-forgelab/compatibility";
import { doctor as inspectToolchains } from "@mc-forgelab/toolchain-manager";
import type { ToolchainStatus } from "@mc-forgelab/toolchain-manager";
import type { ProgramContext } from "../program.js";

interface CheckLine {
  readonly name: string;
  readonly status: "ok" | "warn" | "miss" | "info";
  readonly detail: string;
}

type NetworkStatus = "ok" | "warn" | "miss";

interface NetworkCheck {
  readonly url: string;
  readonly status: NetworkStatus;
  readonly latencyMs: number;
  readonly error?: string;
}

const NETWORK_CHECK_URLS = [
  "https://api.adoptium.net/v3/info/available_releases",
  "https://services.gradle.org/distributions/",
  "https://repo.maven.apache.org/maven2/",
  "https://api.papermc.io/v2/projects"
] as const;

export function registerDoctorCommand(program: Command, ctx: ProgramContext): void {
  const doctor = program
    .command("doctor")
    .description("Environment and configuration health check")
    .option("--json", "Output JSON", false)
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
    .description("Check toolchains only")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const toolchains = await inspectToolchains();
      if (opts.json) {
        ctx.stdout.write(`${JSON.stringify({ toolchains }, null, 2)}\n`);
      } else {
        renderToolchainTable(toolchains, ctx.stdout);
      }
    });

  doctor
    .command("network")
    .description("Check network connectivity")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const checks = await checkNetwork();
      if (opts.json) {
        ctx.stdout.write(`${JSON.stringify({ network: checks }, null, 2)}\n`);
      } else {
        renderNetworkTable(checks, ctx.stdout);
      }
    });

  // Keep the commander constructor referenced so subcommands are parsed reliably in bundled builds.
  void CmdCtor;
}

async function collectChecks(ctx: ProgramContext): Promise<CheckLine[]> {
  const lines: CheckLine[] = [];
  const env = ctx.env;

  lines.push({
    name: "OS",
    status: "ok",
    detail: `${process.platform} (${process.arch}) node ${process.version}`
  });

  try {
    const cfg = loadConfig({ env, mode: "cli" });
    lines.push({ name: "mode", status: "ok", detail: cfg.mode });
    lines.push({ name: "workspace path", status: "ok", detail: cfg.paths.workspace });
    lines.push({ name: "cache path", status: "ok", detail: cfg.paths.cache });
    lines.push({ name: "logs path", status: "ok", detail: cfg.paths.logs });
    lines.push({ name: "db path", status: "ok", detail: cfg.paths.db });
    lines.push({ name: "toolchains path", status: "ok", detail: cfg.paths.toolchains });
    lines.push({
      name: "max build concurrency",
      status: "ok",
      detail: String(cfg.limits.maxBuildConcurrency)
    });
    lines.push({
      name: "auth",
      status: cfg.auth.enabled ? "ok" : "info",
      detail: cfg.auth.enabled ? "enabled" : "disabled (local mode)"
    });
  } catch (e) {
    lines.push({
      name: "config load",
      status: "miss",
      detail: e instanceof Error ? e.message : String(e)
    });
  }

  const toolchains = await inspectToolchains();
  for (const toolchain of toolchains) {
    lines.push({
      name: toolchainName(toolchain),
      status: toolchainCheckStatus(toolchain),
      detail: toolchainDetail(toolchain)
    });
  }

  const networkChecks = await checkNetwork();
  lines.push({ name: "network", status: networkSummaryStatus(networkChecks), detail: networkSummaryDetail(networkChecks) });

  lines.push({ name: "Node runtime", status: "ok", detail: process.versions.node });
  lines.push({ name: "Docker", status: "info", detail: "integrated at stage 7" });

  const registry = createDefaultRegistry();
  const engine = new CompatibilityEngine(registry, builtinRules);
  lines.push({
    name: "target registry",
    status: "ok",
    detail: `v${registry.version} (${registry.list().length} built-in targets)`
  });
  lines.push({
    name: "compatibility registry",
    status: "ok",
    detail: `v${engine.version} (${builtinRules.length} built-in rules)`
  });

  return lines;
}

async function checkNetwork(): Promise<NetworkCheck[]> {
  const checks = await Promise.allSettled(NETWORK_CHECK_URLS.map((url) => checkNetworkUrl(url)));
  return checks.map((check, index) => {
    if (check.status === "fulfilled") return check.value;
    return {
      url: NETWORK_CHECK_URLS[index] ?? "unknown",
      status: "miss",
      latencyMs: 0,
      error: check.reason instanceof Error ? check.reason.message : String(check.reason)
    };
  });
}

function checkNetworkUrl(url: string): Promise<NetworkCheck> {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const done = (check: NetworkCheck) => {
      if (settled) return;
      settled = true;
      resolve(check);
    };

    const req = httpsGet(url, { headers: { "User-Agent": "mc-forgelab-doctor" } }, (res) => {
      const statusCode = res.statusCode ?? 0;
      const status: NetworkStatus = statusCode >= 200 && statusCode < 400 ? "ok" : "warn";
      res.resume();
      done({
        url,
        status,
        latencyMs: Date.now() - started,
        ...(status === "warn" ? { error: `HTTP ${statusCode}` } : {})
      });
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error("Request timed out"));
    });
    req.on("error", (error) => {
      done({ url, status: "miss", latencyMs: Date.now() - started, error: error.message });
    });
  });
}

function toolchainName(status: ToolchainStatus): string {
  if (status.toolName === "java") return `JDK ${status.requestedVersion ?? ""}`.trim();
  if (status.toolName === "gradle") return "Gradle";
  return "Maven";
}

function toolchainCheckStatus(status: ToolchainStatus): CheckLine["status"] {
  if (!status.installed) return "miss";
  if (status.issues.length > 0) return "warn";
  return "ok";
}

function toolchainDetail(status: ToolchainStatus): string {
  return status.issues[0] ?? status.version ?? status.path ?? "installed";
}

function networkSummaryStatus(checks: ReadonlyArray<NetworkCheck>): CheckLine["status"] {
  const ok = checks.filter((check) => check.status === "ok").length;
  const reachable = checks.filter((check) => check.status !== "miss").length;
  if (ok === checks.length) return "ok";
  if (reachable > 0) return "warn";
  return "miss";
}

function networkSummaryDetail(checks: ReadonlyArray<NetworkCheck>): string {
  const reachable = checks.filter((check) => check.status !== "miss").length;
  return `${reachable}/${checks.length} reachable`;
}

function renderToolchainTable(statuses: ReadonlyArray<ToolchainStatus>, stdout: NodeJS.WriteStream): void {
  const table = new Table({
    head: [pc.bold("Toolchain"), pc.bold("Status"), pc.bold("Version"), pc.bold("Path"), pc.bold("Issues")],
    colWidths: [16, 8, 34, 48, 48],
    wordWrap: true,
    style: { head: [], border: ["grey"] }
  });

  for (const status of statuses) {
    table.push([
      toolchainName(status),
      statusLabel(toolchainCheckStatus(status)),
      status.version ?? "-",
      status.path ?? "-",
      status.issues.length > 0 ? status.issues.join("\n") : "-"
    ]);
  }
  stdout.write(`${table.toString()}\n`);
}

function renderNetworkTable(checks: ReadonlyArray<NetworkCheck>, stdout: NodeJS.WriteStream): void {
  const table = new Table({
    head: [pc.bold("URL"), pc.bold("Status"), pc.bold("Latency"), pc.bold("Error")],
    colWidths: [58, 8, 12, 48],
    wordWrap: true,
    style: { head: [], border: ["grey"] }
  });

  for (const check of checks) {
    table.push([check.url, statusLabel(check.status), `${check.latencyMs}ms`, check.error ?? "-"]);
  }
  stdout.write(`${table.toString()}\n`);
}

function renderTable(lines: ReadonlyArray<CheckLine>, stdout: NodeJS.WriteStream): void {
  const table = new Table({
    head: [pc.bold("Item"), pc.bold("Status"), pc.bold("Detail")],
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
