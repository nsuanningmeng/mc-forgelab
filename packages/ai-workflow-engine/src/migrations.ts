import type { Migration } from "@mc-forgelab/storage";

export const STAGE3_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0003_ai_workflow",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS ai_workflows (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          mode TEXT NOT NULL,
          definition_json TEXT NOT NULL,
          builtin INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_workflow_runs (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          project_id TEXT,
          user_prompt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          started_at TEXT NOT NULL,
          finished_at TEXT,
          selected_provider_id TEXT,
          selected_model TEXT,
          summary TEXT,
          error_message TEXT,
          FOREIGN KEY (workflow_id) REFERENCES ai_workflows(id)
        );
        CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON ai_workflow_runs(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON ai_workflow_runs(workflow_id);

        CREATE TABLE IF NOT EXISTS ai_workflow_steps (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          role TEXT NOT NULL,
          model_profile TEXT,
          provider_id TEXT,
          model TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          started_at TEXT NOT NULL,
          finished_at TEXT,
          input_summary TEXT,
          output_summary TEXT,
          token_usage_input INTEGER NOT NULL DEFAULT 0,
          token_usage_output INTEGER NOT NULL DEFAULT 0,
          cost_estimate REAL NOT NULL DEFAULT 0,
          error_message TEXT,
          FOREIGN KEY (run_id) REFERENCES ai_workflow_runs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON ai_workflow_steps(run_id);

        CREATE TABLE IF NOT EXISTS ai_call_logs (
          id TEXT PRIMARY KEY,
          workflow_run_id TEXT,
          step_id TEXT,
          provider_id TEXT NOT NULL,
          model TEXT NOT NULL,
          request_id TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          status TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          cost_estimate REAL NOT NULL DEFAULT 0,
          error_code TEXT,
          error_message TEXT,
          latency_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_call_logs_run ON ai_call_logs(workflow_run_id);
      `);
    }
  }
];
