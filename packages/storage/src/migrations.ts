import type { StorageBackend } from "./storage.js";

export interface Migration {
  readonly id: string;
  /** 必须幂等：迁移已应用时不应抛错。runMigrations 通过元表确保只执行一次 */
  apply(backend: StorageBackend): void;
}

/**
 * 阶段 1 基础迁移：
 * - _mcforgelab_migrations 元表
 * - settings 表
 * - projects 表（占位骨架，字段名匹配 SQLite snake_case 约定）
 * - builds 表（占位）
 * - artifacts 表（占位）
 */
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
          created_at TEXT NOT NULL,
          downloadable INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_build ON artifacts(build_id);
      `);
    }
  }
];

/**
 * 顺序执行尚未应用的迁移。
 * 设计要点：每条迁移在事务内执行（SQLite 支持 DDL 事务），失败回滚。
 * 内存 backend 不支持事务，按线性顺序应用即可。
 */
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
