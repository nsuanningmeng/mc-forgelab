import { describe, it, expect } from "vitest";
import { createLogger, memorySink, LOG_LEVELS } from "./index.js";

describe("logger", () => {
  it("filters below current level", () => {
    const sink = memorySink();
    const log = createLogger({ level: "warn", sinks: [sink] });
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(sink.records.map((r) => r.level)).toEqual(["warn", "error"]);
  });

  it("child merges context", () => {
    const sink = memorySink();
    const log = createLogger({ level: "trace", sinks: [sink], context: { app: "cli" } });
    const child = log.child({ requestId: "abc" });
    child.info("hello");
    const rec = sink.records.at(-1)!;
    expect(rec.context).toMatchObject({ app: "cli", requestId: "abc" });
  });

  it("child does not mutate parent", () => {
    const sink = memorySink();
    const log = createLogger({ level: "trace", sinks: [sink], context: { a: 1 } });
    const c = log.child({ b: 2 });
    expect(log.context).toEqual({ a: 1 });
    expect(c.context).toEqual({ a: 1, b: 2 });
  });

  it("captures Error metadata", () => {
    const sink = memorySink();
    const log = createLogger({ sinks: [sink] });
    log.error("oops", new Error("boom"));
    const rec = sink.records.at(-1)!;
    expect(rec.error?.message).toBe("boom");
  });

  it("setLevel mutates current logger only", () => {
    const sink = memorySink();
    const log = createLogger({ level: "info", sinks: [sink] });
    log.debug("not-emitted");
    log.setLevel("trace");
    log.debug("emitted");
    expect(sink.records.length).toBe(1);
  });

  it("LOG_LEVELS exported in expected order", () => {
    expect([...LOG_LEVELS]).toEqual(["trace", "debug", "info", "warn", "error", "fatal"]);
  });
});
