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
  },
  {
    id: "0014_chat_messages",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          role TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'text',
          content TEXT NOT NULL DEFAULT '',
          content_json TEXT,
          timestamp TEXT NOT NULL,
          sequence INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_project
          ON chat_messages(project_id, sequence);
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
