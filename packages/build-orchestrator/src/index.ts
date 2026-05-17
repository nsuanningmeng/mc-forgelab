/**
 * @mc-forgelab/build-orchestrator — 阶段 5 实施
 *
 * 严格约束：
 * - 禁止执行用户输入的任意 shell 字符串
 * - 禁止字符串拼接命令
 * - 默认不使用系统 PATH
 * - 使用 spawn(executable, args[], { shell: false })
 * - 工作目录限制在 workspace 内 (resolveInsideBase)
 * - 必须支持 cancel + timeout + 完整日志保存 + 友好错误摘要
 */

export type BuildStatus = "queued" | "running" | "success" | "failed" | "canceled" | "interrupted";
export type BuildCommand = "clean" | "build" | "test" | "package" | "publishLocal" | "runServer";

export interface BuildPlanStep {
  readonly stepId: string;
  readonly displayName: string;
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

export interface BuildPlan {
  readonly projectId: string;
  readonly buildId: string;
  readonly steps: ReadonlyArray<BuildPlanStep>;
}

export interface BuildRecord {
  readonly buildId: string;
  readonly projectId: string;
  readonly status: BuildStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly logPath: string;
  readonly errorSummary?: string;
  readonly compatibilityWarnings: ReadonlyArray<string>;
}

export interface BuildOrchestrator {
  createPlan(projectId: string, command: BuildCommand): Promise<BuildPlan>;
  execute(plan: BuildPlan, onLog: (line: string) => void): Promise<BuildRecord>;
  cancel(buildId: string): Promise<void>;
}

export function createBuildOrchestrator(): BuildOrchestrator {
  return {
    async createPlan() {
      throw new Error("build-orchestrator.createPlan: not implemented (stage 5)");
    },
    async execute() {
      throw new Error("build-orchestrator.execute: not implemented (stage 5)");
    },
    async cancel() {
      throw new Error("build-orchestrator.cancel: not implemented (stage 5)");
    }
  };
}
