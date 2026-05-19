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
  },
  {
    id: "0009_workflow_runtime_state",
    apply(backend) {
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN parent_run_id TEXT");
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN trigger_type TEXT DEFAULT 'manual'");
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN patch_review_enabled INTEGER DEFAULT 0");
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN waiting_for TEXT");
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN canceled_at TEXT");
      backend.exec("ALTER TABLE ai_workflow_runs ADD COLUMN retry_of_run_id TEXT");
      backend.exec("CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON ai_workflow_runs(project_id)");
      backend.exec("CREATE INDEX IF NOT EXISTS idx_workflow_runs_parent ON ai_workflow_runs(parent_run_id)");
    }
  },
  {
    id: "0010_workflow_step_runtime",
    apply(backend) {
      backend.exec("ALTER TABLE ai_workflow_steps ADD COLUMN sequence INTEGER DEFAULT 0");
      backend.exec("ALTER TABLE ai_workflow_steps ADD COLUMN duration_ms INTEGER DEFAULT 0");
      backend.exec("ALTER TABLE ai_workflow_steps ADD COLUMN input_ref TEXT");
      backend.exec("ALTER TABLE ai_workflow_steps ADD COLUMN output_ref TEXT");
      backend.exec("ALTER TABLE ai_workflow_steps ADD COLUMN cost_currency TEXT DEFAULT 'USD'");
    }
  },
  {
    id: "0011_workflow_events_outputs",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS ai_workflow_events (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          step_row_id TEXT,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sequence INTEGER NOT NULL
        );
      `);
      backend.exec("CREATE INDEX IF NOT EXISTS idx_workflow_events_run ON ai_workflow_events(run_id, sequence)");
      backend.exec(`
        CREATE TABLE IF NOT EXISTS ai_workflow_outputs (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          step_row_id TEXT,
          key TEXT NOT NULL,
          content_type TEXT NOT NULL DEFAULT 'text',
          value_text TEXT,
          file_path TEXT,
          created_at TEXT NOT NULL
        );
      `);
      backend.exec("CREATE INDEX IF NOT EXISTS idx_workflow_outputs_run_key ON ai_workflow_outputs(run_id, key)");
    }
  }
];
