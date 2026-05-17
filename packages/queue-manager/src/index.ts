/**
 * @mc-forgelab/queue-manager — 阶段 5/6 实施
 *
 * - 默认最大并发 1，通过 MC_FORGELAB_MAX_BUILD_CONCURRENCY 修改
 * - 超出并发入 queued
 * - 服务重启时 running -> failed/interrupted
 * - 取消 queued 与 running 构建
 * - 不能孤儿化子进程
 */

export type JobStatus = "queued" | "running" | "success" | "failed" | "canceled" | "interrupted";

export interface JobRecord {
  readonly jobId: string;
  readonly type: string;
  readonly status: JobStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface JobQueue {
  enqueue(type: string, payload: Readonly<Record<string, unknown>>): Promise<JobRecord>;
  get(jobId: string): Promise<JobRecord>;
  cancel(jobId: string): Promise<void>;
  listActive(): Promise<ReadonlyArray<JobRecord>>;
}

export function createJobQueue(): JobQueue {
  return {
    async enqueue() {
      throw new Error("queue-manager: not implemented (stage 5/6)");
    },
    async get() {
      throw new Error("queue-manager: not implemented (stage 5/6)");
    },
    async cancel() {
      throw new Error("queue-manager: not implemented (stage 5/6)");
    },
    async listActive() {
      return [];
    }
  };
}
