import type { StorageBackend } from "./storage.js";

export interface Migration {
  readonly id: string;
  /** Must be idempotent. runMigrations records applied ids in the metadata table. */
  apply(backend: StorageBackend): void;
}

export const BASE_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0001_init",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS _mcforgelab_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          minecraft_version TEXT NOT NULL,
          java_version INTEGER NOT NULL,
          build_tool TEXT NOT NULL,
          package_name TEXT NOT NULL,
          main_class TEXT,
          project_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_projects_target ON projects(target_id);

        CREATE TABLE IF NOT EXISTS builds (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          target_id TEXT NOT NULL,
          minecraft_version TEXT NOT NULL,
          java_version INTEGER NOT NULL,
          build_tool TEXT NOT NULL,
          log_path TEXT,
          error_summary TEXT,
          compatibility_warnings TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_builds_project ON builds(project_id);
        CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);

        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          build_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          type TEXT NOT NULL,
          target_id TEXT NOT NULL DEFAULT '',
          minecraft_version TEXT NOT NULL DEFAULT '',
          java_version INTEGER NOT NULL DEFAULT 17,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL DEFAULT '',
          downloadable INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_build ON artifacts(build_id);
      `);
    }
  },
  {
    id: "0012_build_persistence",
    apply(backend) {
      const buildColumns = backend.all<{ name: string }>("PRAGMA table_info(builds)");
      const hasErrorSummary = buildColumns.some((col) => col.name === "error_summary");
      if (!hasErrorSummary) {
        backend.exec("ALTER TABLE builds ADD COLUMN error_summary TEXT");
      }

      backend.exec(`
        CREATE TABLE IF NOT EXISTS build_events (
          id TEXT PRIMARY KEY,
          build_id TEXT NOT NULL,
          type TEXT NOT NULL,
          line TEXT,
          payload_json TEXT,
          created_at TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_build_events_build ON build_events(build_id, sequence);
      `);

      backend.run(
        "UPDATE builds SET status = 'interrupted', finished_at = COALESCE(finished_at, ?) WHERE status IN ('running', 'queued')",
        [new Date().toISOString()]
      );
    }
  }
];

export function runMigrations(backend: StorageBackend, migrations: ReadonlyArray<Migration>): void {
  backend.exec(`CREATE TABLE IF NOT EXISTS _mcforgelab_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);

  const appliedRows = backend.all<{ id: string }>("SELECT id FROM _mcforgelab_migrations");
  const applied = new Set(appliedRows.map((r) => r.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const useTx = backend.name === "sqlite";
    if (useTx) backend.exec("BEGIN");
    try {
      migration.apply(backend);
      backend.run("INSERT INTO _mcforgelab_migrations (id, applied_at) VALUES (?, ?)", [
        migration.id,
        new Date().toISOString()
      ]);
      if (useTx) backend.exec("COMMIT");
    } catch (e) {
      if (useTx) {
        try {
          backend.exec("ROLLBACK");
        } catch {
          // ignore
        }
      }
      throw e;
    }
  }
}

export const STAGE6_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0006_artifacts_metadata",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS artifacts_v2 (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          build_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          type TEXT NOT NULL,
          target_id TEXT NOT NULL DEFAULT '',
          minecraft_version TEXT NOT NULL DEFAULT '',
          java_version INTEGER NOT NULL DEFAULT 17,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL DEFAULT '',
          downloadable INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_v2_project ON artifacts_v2(project_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_v2_build ON artifacts_v2(build_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_v2_expires ON artifacts_v2(expires_at);
      `);
    }
  }
];
