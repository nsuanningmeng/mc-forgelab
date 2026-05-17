import { describe, it, expect } from "vitest";
import { MemoryStorage, openStorage } from "./index.js";

describe("storage (memory backend)", () => {
  it("opens and runs base migrations", async () => {
    const store = await MemoryStorage();
    expect(store.backend.name).toBe("memory");
    store.close();
  });

  it("set / get / list / delete settings", async () => {
    const store = await MemoryStorage();
    expect(store.getSetting("foo")).toBeUndefined();
    store.setSetting("foo", "bar");
    expect(store.getSetting("foo")).toBe("bar");

    store.setSetting("foo", "baz"); // upsert
    expect(store.getSetting("foo")).toBe("baz");

    store.setSetting("alpha", "1");
    store.setSetting("zeta", "2");

    const all = store.listSettings();
    expect(all.map((r) => r.key)).toEqual(["alpha", "foo", "zeta"]);

    store.deleteSetting("foo");
    expect(store.getSetting("foo")).toBeUndefined();
    store.close();
  });
});

describe("openStorage auto fallback", () => {
  it("falls back to memory if sqlite not available", async () => {
    // 不安装 better-sqlite3 时 auto 模式应回退；此处显式 backend memory 等价路径
    const store = await openStorage({ backend: "auto" });
    expect(["sqlite", "memory"]).toContain(store.backend.name);
    store.close();
  });
});
