import type { JsonValue } from "@mc-forgelab/core";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

export type LogContext = Readonly<Record<string, JsonValue>>;

export interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
  readonly error?: { readonly name: string; readonly message: string; readonly stack?: string };
}

export interface LogSink {
  readonly name: string;
  write(record: LogRecord): void;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly context?: LogContext;
  readonly sinks?: readonly LogSink[];
}

export interface Logger {
  readonly level: LogLevel;
  readonly context: LogContext;
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext | Error): void;
  fatal(message: string, context?: LogContext | Error): void;
  child(context: LogContext): Logger;
  setLevel(level: LogLevel): void;
}

function shouldEmit(current: LogLevel, target: LogLevel): boolean {
  return LEVEL_RANK[target] >= LEVEL_RANK[current];
}

function toErrorRecord(e: Error): { name: string; message: string; stack?: string } {
  const out: { name: string; message: string; stack?: string } = {
    name: e.name,
    message: e.message
  };
  if (e.stack) out.stack = e.stack;
  return out;
}

/**
 * 创建结构化 logger。
 *
 * 设计要点：
 * - 不直接依赖 pino，便于在 Electron / 浏览器 / 测试场景替换。
 * - context 在 child() 中浅合并，且不会反向覆写父 context（child 字段优先）。
 * - error 实例通过位置参数传入，自动转为 { name, message, stack } 结构，避免循环引用。
 * - sinks 失败被静默捕获，单个 sink 不能拖死整个日志链。
 */
export function createLogger(opts: LoggerOptions = {}): Logger {
  let currentLevel: LogLevel = opts.level ?? "info";
  const baseContext: LogContext = opts.context ?? {};
  const sinks: readonly LogSink[] = opts.sinks && opts.sinks.length > 0 ? opts.sinks : [createDefaultSink()];

  const emit = (level: LogLevel, message: string, extra?: LogContext | Error): void => {
    if (!shouldEmit(currentLevel, level)) return;
    let context: LogContext = baseContext;
    let error: LogRecord["error"];
    if (extra instanceof Error) {
      error = toErrorRecord(extra);
    } else if (extra) {
      context = { ...baseContext, ...extra };
    }
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...(error ? { error } : {})
    };
    for (const sink of sinks) {
      try {
        sink.write(record);
      } catch {
        // 不能让 sink 影响业务流程
      }
    }
  };

  const api: Logger = {
    get level() {
      return currentLevel;
    },
    get context() {
      return baseContext;
    },
    trace: (m, c) => emit("trace", m, c),
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
    fatal: (m, c) => emit("fatal", m, c),
    child(ctx) {
      return createLogger({ level: currentLevel, context: { ...baseContext, ...ctx }, sinks });
    },
    setLevel(level) {
      currentLevel = level;
    }
  };
  return api;
}

function createDefaultSink(): LogSink {
  // 避免循环依赖：sinks.ts 里也会导出 consoleSink，但为了让 createLogger 在零依赖配置下仍能工作，
  // 这里内联一个最简实现。
  return {
    name: "console",
    write(record) {
      const target = record.level === "error" || record.level === "fatal" ? console.error : console.log;
      const payload: Record<string, JsonValue> = {
        ts: record.timestamp,
        level: record.level,
        msg: record.message,
        ...record.context
      };
      if (record.error) payload.err = record.error as unknown as JsonValue;
      target(JSON.stringify(payload));
    }
  };
}
