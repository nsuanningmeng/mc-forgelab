import type { JsonValue } from "@mc-forgelab/core";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { Logger } from "@mc-forgelab/logger";
import { runMigrations, BASE_MIGRATIONS, type Migration } from "./migrations.js";

export interface SettingsRow {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface StorageBackend {
  readonly name: "sqlite" | "memory";
  exec(sql: string): void;
  /** 返回所有匹配行；params 仅支持基础值（更复杂的查询由具体适配器扩展） */
  all<T = Record<string, unknown>>(sql: string, params?: ReadonlyArray<string | number | null>): T[];
  get<T = Record<string, unknown>>(sql: string, params?: ReadonlyArray<string | number | null>): T | undefined;
  run(sql: string, params?: ReadonlyArray<string | number | null>): { changes: number; lastInsertRowid: number };
  close(): void;
}

export interface StorageOptions {
  readonly dbPath?: string;
  readonly backend?: "sqlite" | "memory" | "auto";
  readonly migrations?: ReadonlyArray<Migration>;
  readonly logger?: Logger;
}

export interface Storage {
  readonly backend: StorageBackend;
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  listSettings(): SettingsRow[];
  deleteSetting(key: string): void;
  close(): void;
}

/**
 * 打开存储；阶段 1 主要消费 settings 表。
 * - backend "auto"：优先 sqlite，加载失败退回 memory（CI/受限环境友好）
 * - backend "memory"：内存 backend，单测专用
 * - backend "sqlite"：必须能加载 better-sqlite3，失败抛 AppError
 */
export async function openStorage(opts: StorageOptions = {}): Promise<Storage> {
  const wanted: "sqlite" | "memory" | "auto" = opts.backend ?? (opts.dbPath ? "sqlite" : "auto");
  let backend: StorageBackend;

  if (wanted === "memory") {
    backend = createMemoryBackend();
  } else {
    try {
      backend = await createSqliteBackend(opts.dbPath ?? ":memory:");
    } catch (cause) {
      if (wanted === "sqlite") {
        throw new AppError(ErrorCode.STORAGE_OPEN_FAILED, { cause });
      }
      opts.logger?.warn("Falling back to in-memory storage backend", {
        reason: cause instanceof Error ? cause.message : String(cause)
      });
      backend = createMemoryBackend();
    }
  }

  try {
    runMigrations(backend, opts.migrations ?? BASE_MIGRATIONS);
  } catch (cause) {
    backend.close();
    throw new AppError(ErrorCode.STORAGE_MIGRATION_FAILED, { cause });
  }

  return makeStorage(backend);
}

/**
 * 显式内存存储，便于测试。已运行迁移。
 */
export async function MemoryStorage(): Promise<Storage> {
  return openStorage({ backend: "memory" });
}

function makeStorage(backend: StorageBackend): Storage {
  return {
    backend,
    getSetting(key) {
      const row = backend.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
      return row?.value;
    },
    setSetting(key, value) {
      const now = new Date().toISOString();
      backend.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, now]
      );
    },
    listSettings() {
      return backend.all<{ key: string; value: string; updated_at: string }>(
        "SELECT key, value, updated_at FROM settings ORDER BY key"
      ).map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
    },
    deleteSetting(key) {
      backend.run("DELETE FROM settings WHERE key = ?", [key]);
    },
    close() {
      backend.close();
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Backends
// ──────────────────────────────────────────────────────────────────────────

async function createSqliteBackend(dbPath: string): Promise<StorageBackend> {
  // Ensure parent directory exists for real on-disk paths. Skipping this for
  // ":memory:" keeps that path free of side effects. mkdir failures still
  // surface as STORAGE_OPEN_FAILED via the catch in openStorage().
  if (dbPath !== ":memory:") {
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  // 通过动态 import + createRequire 隔离 native CJS module，保持本包对外 ESM。
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  // 仅在运行时解析，类型层面用 unknown 然后局部 narrow
  const SqliteCtor = require("better-sqlite3") as new (path: string) => SqliteInstance;
  const db: SqliteInstance = new SqliteCtor(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    name: "sqlite",
    exec(sql) {
      db.exec(sql);
    },
    all(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...(params as unknown[])) as never[];
    },
    get(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.get(...(params as unknown[])) as never | undefined;
    },
    run(sql, params = []) {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(params as unknown[]));
      return {
        changes: Number(info.changes),
        lastInsertRowid: Number(info.lastInsertRowid)
      };
    },
    close() {
      db.close();
    }
  };
}

interface SqliteStatement {
  all(...args: unknown[]): unknown;
  get(...args: unknown[]): unknown;
  run(...args: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
interface SqliteInstance {
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatement;
  pragma(stmt: string): unknown;
  close(): void;
}

// 内存 backend：通用 Map-based 实现，支持任意表，用于测试。
function createMemoryBackend(): StorageBackend {
  // table name → rows (each row is a Record)
  const tables = new Map<string, Array<Record<string, unknown>>>();
  const meta: string[] = [];

  function getTable(name: string): Array<Record<string, unknown>> {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  }

  function parseTableName(sql: string): string | null {
    const m = sql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
    return m?.[1]?.toLowerCase() ?? null;
  }

  return {
    name: "memory",
    exec(_sql) { /* DDL is no-op for memory backend */ },
    all(sql, params = []) {
      if (/FROM _mcforgelab_migrations/i.test(sql)) {
        return meta.map((id) => ({ id })) as never[];
      }
      const tbl = parseTableName(sql);
      if (!tbl) return [] as never[];
      const rows = getTable(tbl);
      // ORDER BY support (simple: sort by first ORDER BY column)
      const orderMatch = sql.match(/ORDER BY\s+(\w+)/i);
      let result = [...rows];
      if (orderMatch) {
        const col = orderMatch[1]!.toLowerCase();
        result = result.sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")));
      }
      // Simple WHERE id = ? support
      const whereId = sql.match(/WHERE\s+id\s*=\s*\?/i);
      if (whereId && params.length > 0) {
        return result.filter((r) => r.id === params[0]) as never[];
      }
      // WHERE role = ? AND enabled = 1
      const whereRole = sql.match(/WHERE\s+role\s*=\s*\?\s+AND\s+enabled\s*=\s*1/i);
      if (whereRole && params.length > 0) {
        return result.filter((r) => r.role === params[0] && r.enabled === 1) as never[];
      }
      // WHERE workflow_id = ?
      const whereWf = sql.match(/WHERE\s+workflow_id\s*=\s*\?/i);
      if (whereWf && params.length > 0) {
        return result.filter((r) => r.workflow_id === params[0]) as never[];
      }
      // WHERE run_id = ?
      const whereRun = sql.match(/WHERE\s+run_id\s*=\s*\?/i);
      if (whereRun && params.length > 0) {
        return result.filter((r) => r.run_id === params[0]) as never[];
      }
      return result as never[];
    },
    get(sql, params = []) {
      if (/FROM _mcforgelab_migrations/i.test(sql)) return undefined;
      const tbl = parseTableName(sql);
      if (!tbl) return undefined;
      const rows = getTable(tbl);
      // WHERE id = ?
      if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
        return (rows.find((r) => r.id === params[0]) ?? undefined) as never | undefined;
      }
      // WHERE key = ?
      if (/WHERE\s+key\s*=\s*\?/i.test(sql) && params.length > 0) {
        return (rows.find((r) => r.key === params[0]) ?? undefined) as never | undefined;
      }
      // WHERE role = ? ... LIMIT 1
      if (/WHERE\s+role\s*=\s*\?/i.test(sql) && params.length > 0) {
        return (rows.find((r) => r.role === params[0] && r.enabled === 1) ?? undefined) as never | undefined;
      }
      return undefined;
    },
    run(sql, params = []) {
      const p = params ?? [];
      if (/INSERT INTO _mcforgelab_migrations/i.test(sql)) {
        meta.push(p[0] as string);
        return { changes: 1, lastInsertRowid: 0 };
      }
      const tbl = parseTableName(sql);
      if (!tbl) return { changes: 0, lastInsertRowid: 0 };
      const rows = getTable(tbl);

      if (/^\s*INSERT/i.test(sql)) {
        const colMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
        if (!colMatch) return { changes: 0, lastInsertRowid: 0 };
        const cols = colMatch[1]!.split(",").map((c) => c.trim());
        const row: Record<string, unknown> = {};
        cols.forEach((col, i) => { row[col] = p[i] ?? null; });
        if (/ON CONFLICT/i.test(sql)) {
          // upsert: find by first unique key (key or id)
          const pkCol = cols[0]!;
          const existing = rows.findIndex((r) => r[pkCol] === row[pkCol]);
          if (existing >= 0) { rows[existing] = { ...rows[existing], ...row }; }
          else rows.push(row);
        } else {
          rows.push(row);
        }
        return { changes: 1, lastInsertRowid: rows.length };
      }

      if (/^\s*UPDATE/i.test(sql)) {
        const idParam = p[p.length - 1] as string;
        const idx = rows.findIndex((r) => r.id === idParam);
        if (idx === -1) return { changes: 0, lastInsertRowid: 0 };
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
        if (setMatch) {
          const setParts = setMatch[1]!.split(",").map((s) => s.trim());
          const colNames = setParts.map((s) => s.split("=")[0]!.trim());
          const newRow = { ...rows[idx] };
          colNames.forEach((col, i) => { newRow[col] = p[i] ?? null; });
          rows[idx] = newRow;
        }
        return { changes: 1, lastInsertRowid: 0 };
      }

      if (/^\s*DELETE/i.test(sql)) {
        const param = p[0] as string;
        const before = rows.length;
        // Support WHERE id = ? or WHERE key = ?
        const filtered = /WHERE\s+key\s*=/i.test(sql)
          ? rows.filter((r) => r.key !== param)
          : rows.filter((r) => r.id !== param);
        tables.set(tbl, filtered);
        return { changes: before - filtered.length, lastInsertRowid: 0 };
      }

      return { changes: 0, lastInsertRowid: 0 };
    },
    close() { tables.clear(); }
  };
}
