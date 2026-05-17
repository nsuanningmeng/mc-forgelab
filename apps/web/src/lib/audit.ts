import { randomUUID } from "node:crypto";
import type { Migration, Storage } from "@mc-forgelab/storage";

export const STAGE_WEB_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0010_audit_log",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          payload_json TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
      `);
    }
  }
];

export interface AuditLogInput {
  readonly eventType: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly payload?: Record<string, unknown>;
}

export interface AuditLogger {
  log(input: AuditLogInput): void;
}

export function createAuditLogger(storage: Storage): AuditLogger {
  return {
    log(input) {
      storage.backend.run(
        "INSERT INTO audit_log (id, event_type, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          randomUUID(),
          input.eventType,
          input.entityType ?? null,
          input.entityId ?? null,
          input.payload ? JSON.stringify(input.payload) : null,
          new Date().toISOString()
        ]
      );
    }
  };
}
