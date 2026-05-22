import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Storage, StorageBackend } from "@mc-forgelab/storage";
import type { RuntimeEvent, StartRunInput, WorkflowRuntime } from "@mc-forgelab/ai-workflow-engine";
import { registerAIRoutes } from "./ai.js";
import type { AppContext } from "./types.js";

const WORKFLOW_ID = "simple-single-model";

interface WorkflowRunRow {
  readonly id: string;
  readonly workflow_id: string;
  readonly project_id: string | null;
  readonly user_prompt: string;
  readonly status: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly summary: string | null;
}

class RouteTestBackend implements StorageBackend {
  readonly name = "memory";
  private readonly projects = new Set<string>();
  private readonly workflows = new Set<string>([WORKFLOW_ID]);
  private readonly runs: WorkflowRunRow[] = [];

  exec(): void {}

  all<T = Record<string, unknown>>(sql: string, params: ReadonlyArray<string | number | null> = []): T[] {
    if (/FROM ai_workflow_runs/i.test(sql) && /status = 'success'/i.test(sql)) {
      const projectId = String(params[0] ?? "");
      const limit = Number(params[1] ?? 5);
      return this.runs
        .filter((row) =>
          row.project_id === projectId &&
          row.status === "success" &&
          row.summary !== null &&
          row.summary.trim().length > 0
        )
        .sort((a, b) =>
          String(b.finished_at ?? b.started_at).localeCompare(String(a.finished_at ?? a.started_at))
        )
        .slice(0, limit) as T[];
    }

    if (/FROM ai_workflow_runs/i.test(sql)) {
      return [...this.runs] as T[];
    }

    if (/FROM ai_workflows/i.test(sql)) {
      return [...this.workflows].map((id) => ({
        id,
        name: id,
        mode: "single-model",
        builtin: 1,
        created_at: "2026-01-01T00:00:00.000Z"
      })) as T[];
    }

    return [];
  }

  get<T = Record<string, unknown>>(sql: string, params: ReadonlyArray<string | number | null> = []): T | undefined {
    if (/FROM ai_workflows/i.test(sql) && /WHERE id = \?/i.test(sql)) {
      const id = String(params[0] ?? "");
      return this.workflows.has(id) ? ({ id } as T) : undefined;
    }

    if (/FROM projects/i.test(sql) && /WHERE id = \?/i.test(sql)) {
      const id = String(params[0] ?? "");
      return this.projects.has(id) ? ({ id } as T) : undefined;
    }

    if (/FROM ai_workflow_runs/i.test(sql) && /status IN/i.test(sql)) {
      const projectId = String(params[0] ?? "");
      const active = this.runs.find((row) =>
        row.project_id === projectId &&
        ["pending", "running", "waiting_confirmation"].includes(row.status)
      );
      return active ? ({ id: active.id } as T) : undefined;
    }

    if (/FROM ai_workflow_runs/i.test(sql) && /WHERE id = \?/i.test(sql)) {
      const id = String(params[0] ?? "");
      return this.runs.find((row) => row.id === id) as T | undefined;
    }

    return undefined;
  }

  run(sql: string, params: ReadonlyArray<string | number | null> = []): { changes: number; lastInsertRowid: number } {
    if (/INSERT INTO projects/i.test(sql)) {
      this.projects.add(String(params[0] ?? ""));
      return { changes: 1, lastInsertRowid: this.projects.size };
    }

    if (/INSERT INTO ai_workflow_runs/i.test(sql)) {
      this.runs.push({
        id: String(params[0] ?? ""),
        workflow_id: String(params[1] ?? ""),
        project_id: params[2] === null ? null : String(params[2] ?? ""),
        user_prompt: String(params[3] ?? ""),
        status: String(params[4] ?? ""),
        started_at: String(params[5] ?? ""),
        finished_at: params[6] === null ? null : String(params[6] ?? ""),
        summary: params[7] === null ? null : String(params[7] ?? "")
      });
      return { changes: 1, lastInsertRowid: this.runs.length };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  close(): void {
    this.projects.clear();
    this.runs.splice(0, this.runs.length);
  }
}

let app: FastifyInstance;
let backend: RouteTestBackend;
let startRunInputs: StartRunInput[];

function makeContext(): AppContext {
  const storage: Storage = {
    backend,
    getSetting: () => undefined,
    setSetting: () => undefined,
    listSettings: () => [],
    deleteSetting: () => undefined,
    close: () => backend.close()
  };

  const workflowRuntime: WorkflowRuntime = {
    async startRun(input) {
      startRunInputs.push(input);
      return { runId: `new-run-${startRunInputs.length}` };
    },
    async cancelRun() {
      return false;
    },
    async retryRunFromStep() {
      return { runId: "retry-run" };
    },
    async confirmPatch() {
      return undefined;
    },
    subscribe() {
      return () => undefined;
    },
    loadRunEvents(): RuntimeEvent[] {
      return [];
    },
    closeAll() {
      return undefined;
    }
  };

  return {
    storage,
    workflowRuntime,
    artifacts: {},
    cfg: {},
    providers: {},
    builds: {},
    auditor: { log: () => undefined }
  } as AppContext;
}

function insertProject(id: string): void {
  backend.run(
    `INSERT INTO projects (
      id, name, slug, type, target_id, minecraft_version, java_version,
      build_tool, package_name, project_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      id,
      id,
      "plugin",
      "paper",
      "1.20.1",
      17,
      "gradle",
      `com.example.${id.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      `/workspace/${id}`,
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    ]
  );
}

function insertHistoricalRun(input: {
  id: string;
  projectId: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string | null;
  summary?: string | null;
}): void {
  const finishedAt = input.finishedAt ?? input.startedAt ?? "2026-01-01T00:00:00.000Z";
  backend.run(
    `INSERT INTO ai_workflow_runs (
      id, workflow_id, project_id, user_prompt, status, started_at, finished_at, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      WORKFLOW_ID,
      input.projectId,
      `prompt-${input.id}`,
      input.status ?? "success",
      input.startedAt ?? finishedAt,
      finishedAt,
      input.summary === undefined ? `summary-${input.id}` : input.summary
    ]
  );
}

async function startWorkflow(projectId: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/workflow-runs",
    payload: {
      workflowId: WORKFLOW_ID,
      prompt: "Create a plugin",
      projectId
    }
  });
  expect(res.statusCode).toBe(202);
}

function latestStartRunInput(): StartRunInput {
  const input = startRunInputs.at(-1);
  expect(input).toBeDefined();
  return input as StartRunInput;
}

function expectSingleHistoryMessage(): string {
  const messages = latestStartRunInput().contextMessages ?? [];
  expect(messages).toHaveLength(1);
  expect(messages[0]?.role).toBe("system");
  return messages[0]?.content ?? "";
}

beforeEach(async () => {
  backend = new RouteTestBackend();
  startRunInputs = [];
  app = Fastify({ logger: false });
  await registerAIRoutes(app, makeContext());
});

afterEach(async () => {
  await app.close();
});

describe("POST /api/ai/workflow-runs history context", () => {
  it("passes only the latest 5 successful workflow summaries as context", async () => {
    const projectId = "project-latest-five";
    insertProject(projectId);
    for (let i = 1; i <= 6; i += 1) {
      insertHistoricalRun({
        id: `run-${i}`,
        projectId,
        finishedAt: `2026-01-01T00:0${i}:00.000Z`,
        summary: `summary-${i}`
      });
    }

    await startWorkflow(projectId);

    const content = expectSingleHistoryMessage();
    expect(content).toContain("Previous successful workflow summaries");
    expect(content).toContain("#1 run=run-6");
    expect(content).toContain("#5 run=run-2");
    expect(content).toContain("summary-6");
    expect(content).toContain("summary-2");
    expect(content).not.toContain("summary-1");
    expect(content.indexOf("summary-6")).toBeLessThan(content.indexOf("summary-5"));
  });

  it("filters failed and non-terminal workflow runs out of history context", async () => {
    const projectId = "project-filter-status";
    insertProject(projectId);
    insertHistoricalRun({
      id: "failed-newest",
      projectId,
      status: "failed",
      finishedAt: "2026-01-01T00:04:00.000Z",
      summary: "failed summary"
    });
    insertHistoricalRun({
      id: "canceled-newer",
      projectId,
      status: "canceled",
      finishedAt: "2026-01-01T00:03:00.000Z",
      summary: "canceled summary"
    });
    insertHistoricalRun({
      id: "success-newer",
      projectId,
      status: "success",
      finishedAt: "2026-01-01T00:02:00.000Z",
      summary: "success newer summary"
    });
    insertHistoricalRun({
      id: "success-blank",
      projectId,
      status: "success",
      finishedAt: "2026-01-01T00:01:30.000Z",
      summary: "   "
    });
    insertHistoricalRun({
      id: "success-older",
      projectId,
      status: "success",
      finishedAt: "2026-01-01T00:01:00.000Z",
      summary: "success older summary"
    });

    await startWorkflow(projectId);

    const content = expectSingleHistoryMessage();
    expect(content).toContain("success newer summary");
    expect(content).toContain("success older summary");
    expect(content).not.toContain("failed summary");
    expect(content).not.toContain("canceled summary");
    expect(content).not.toContain("success-blank");
  });

  it("passes an empty contextMessages array when the project has no workflow history", async () => {
    const projectId = "project-no-history";
    insertProject(projectId);

    await startWorkflow(projectId);

    expect(latestStartRunInput().contextMessages).toEqual([]);
  });

  it("truncates long workflow summaries in history context", async () => {
    const projectId = "project-truncate-summary";
    const longSummary = `${"a".repeat(2000)}TAIL_SHOULD_NOT_APPEAR`;
    insertProject(projectId);
    insertHistoricalRun({
      id: "long-summary-run",
      projectId,
      finishedAt: "2026-01-01T00:01:00.000Z",
      summary: longSummary
    });

    await startWorkflow(projectId);

    const content = expectSingleHistoryMessage();
    expect(content).toContain(`${"a".repeat(2000)}\n[truncated]`);
    expect(content).not.toContain("TAIL_SHOULD_NOT_APPEAR");
  });
});
