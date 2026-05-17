import type { JsonValue } from "@mc-forgelab/core";
import type { LogRecord, LogSink } from "./logger.js";

/**
 * 控制台 sink，开发态推荐。
 * - level >= warn 输出到 stderr
 * - 默认 JSON 一行格式（结构化、可被 jq/grep 直接消费）
 */
export function consoleSink(options: { pretty?: boolean } = {}): LogSink {
  const pretty = options.pretty ?? false;
  return {
    name: "console",
    write(record) {
      const target =
        record.level === "error" || record.level === "fatal" || record.level === "warn"
          ? console.error
          : console.log;
      if (pretty) {
        const ctx = Object.keys(record.context).length > 0 ? ` ${JSON.stringify(record.context)}` : "";
        const err = record.error ? `\n  ${record.error.name}: ${record.error.message}` : "";
        target(`[${record.timestamp}] ${record.level.toUpperCase().padEnd(5)} ${record.message}${ctx}${err}`);
      } else {
        const payload: Record<string, JsonValue> = {
          ts: record.timestamp,
          level: record.level,
          msg: record.message,
          ...record.context
        };
        if (record.error) payload.err = record.error as unknown as JsonValue;
        target(JSON.stringify(payload));
      }
    }
  };
}

/**
 * 内存 sink，仅用于测试与诊断。
 * 缓冲上限 1000 条，超出后丢弃最旧的。
 */
export function memorySink(maxRecords = 1000): LogSink & { records: readonly LogRecord[]; clear(): void } {
  const buffer: LogRecord[] = [];
  return {
    name: "memory",
    write(record) {
      buffer.push(record);
      if (buffer.length > maxRecords) buffer.shift();
    },
    get records() {
      return buffer;
    },
    clear() {
      buffer.length = 0;
    }
  };
}
