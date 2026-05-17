import { isAppError } from "@mc-forgelab/app-error";
import { buildProgram } from "./program.js";
import pc from "picocolors";

/**
 * runCli: 主入口。
 * - 不直接读取 process.* 全局；由调用方注入 argv/env，方便测试。
 * - 退出码：0=success, 1=usage error, 2=app error, 3=unknown internal error。
 */
export async function runCli(
  argv: ReadonlyArray<string>,
  env: Readonly<Record<string, string | undefined>>
): Promise<number> {
  const program = buildProgram({
    env,
    platform: process.platform,
    stdout: process.stdout,
    stderr: process.stderr
  });

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (e) {
    return handleError(e);
  }
}

function handleError(e: unknown): number {
  // commander 自身的 exitOverride 异常
  if (e && typeof e === "object" && "code" in e && typeof (e as { code?: string }).code === "string") {
    const code = (e as { code: string }).code;
    if (code === "commander.helpDisplayed" || code === "commander.version") return 0;
    if (code === "commander.help") return 0;
    if (code.startsWith("commander.")) {
      const msg = (e as { message?: string }).message ?? code;
      process.stderr.write(`${pc.red("✗")} ${msg}\n`);
      return 1;
    }
  }

  if (isAppError(e)) {
    process.stderr.write(`${pc.red("✗")} [${e.code}] ${e.messageZh}\n`);
    if (e.fixSuggestionZh) process.stderr.write(`  ${pc.dim("建议：")} ${e.fixSuggestionZh}\n`);
    return 2;
  }

  process.stderr.write(`${pc.red("✗")} ${e instanceof Error ? e.message : String(e)}\n`);
  return 3;
}
