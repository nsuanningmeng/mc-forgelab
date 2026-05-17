import type { Migration } from "@mc-forgelab/storage";

export const STAGE7_MIGRATIONS: ReadonlyArray<Migration> = [
  {
    id: "0008_knowledge_base",
    apply(backend) {
      backend.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_entries (
          id TEXT PRIMARY KEY,
          target_id TEXT NOT NULL DEFAULT '',
          mc_major TEXT NOT NULL DEFAULT '',
          topic TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags_json TEXT NOT NULL DEFAULT '[]',
          priority INTEGER NOT NULL DEFAULT 100,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_knowledge_lookup ON knowledge_entries(target_id, mc_major, topic);
        CREATE INDEX IF NOT EXISTS idx_knowledge_priority ON knowledge_entries(priority DESC);
      `);
    }
  }
];
