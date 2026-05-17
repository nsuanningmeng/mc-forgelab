import type { Migration } from "@mc-forgelab/storage";

export const STAGE2_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0002_ai_provider",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS ai_providers (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'openai-compatible',
          base_url TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          default_model TEXT NOT NULL,
          available_models TEXT NOT NULL DEFAULT '[]',
          custom_headers TEXT NOT NULL DEFAULT '{}',
          timeout_ms INTEGER NOT NULL DEFAULT 60000,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS model_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          model TEXT NOT NULL,
          role TEXT NOT NULL,
          temperature REAL NOT NULL DEFAULT 0.2,
          max_tokens INTEGER NOT NULL DEFAULT 4096,
          top_p REAL NOT NULL DEFAULT 1.0,
          timeout_ms INTEGER NOT NULL DEFAULT 60000,
          system_prompt TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_model_profiles_role ON model_profiles(role);
        CREATE INDEX IF NOT EXISTS idx_model_profiles_provider ON model_profiles(provider_id);
      `);
    }
  }
];
