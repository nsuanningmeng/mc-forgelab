import type { JsonValue } from "@mc-forgelab/core";
import { ErrorCode, ERROR_CATALOG, type ErrorCodeKey } from "./codes.js";

export type AppErrorSeverity = "info" | "warning" | "error" | "fatal";

export interface AppErrorOptions {
  readonly messageZh?: string;
  readonly messageEn?: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
  readonly httpStatus?: number;
  readonly severity?: AppErrorSeverity;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly cause?: unknown;
}

export interface AppErrorJson {
  readonly name: "AppError";
  readonly code: ErrorCodeKey;
  readonly httpStatus: number;
  readonly severity: AppErrorSeverity;
  readonly messageZh: string;
  readonly messageEn: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly stack?: string;
}

/**
 * 平台统一错误类型。CLI / REST / build orchestrator 全部消费同一语义。
 *
 * - `code` 必须来自 ErrorCode 常量；free-form string 应升级为常量。
 * - `messageEn` 作为 Error.message 主体，便于 stack trace 检索；
 *   `messageZh` 仅供 UI 展示，禁止把 messageZh 喂回工具链。
 * - `details` 中**不得**包含密码、密钥、bearer token 等敏感字段。
 */
export class AppError extends Error {
  override readonly name = "AppError";
  readonly code: ErrorCodeKey;
  readonly httpStatus: number;
  readonly severity: AppErrorSeverity;
  readonly messageZh: string;
  readonly messageEn: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
  readonly details?: Readonly<Record<string, JsonValue>>;

  constructor(code: ErrorCodeKey, options: AppErrorOptions = {}) {
    const entry = ERROR_CATALOG[code];
    const messageEn = options.messageEn ?? entry.messageEn;
    super(messageEn, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.code = code;
    this.httpStatus = options.httpStatus ?? entry.httpStatus;
    this.severity = options.severity ?? "error";
    this.messageZh = options.messageZh ?? entry.messageZh;
    this.messageEn = messageEn;
    if (options.fixSuggestionZh ?? entry.fixSuggestionZh) {
      this.fixSuggestionZh = options.fixSuggestionZh ?? entry.fixSuggestionZh;
    }
    if (options.fixSuggestionEn ?? entry.fixSuggestionEn) {
      this.fixSuggestionEn = options.fixSuggestionEn ?? entry.fixSuggestionEn;
    }
    if (options.details) this.details = options.details;

    if (typeof (Error as unknown as { captureStackTrace?: unknown }).captureStackTrace === "function") {
      (Error as unknown as { captureStackTrace: (t: object, c: Function) => void }).captureStackTrace(
        this,
        AppError
      );
    }
  }

  toJSON(): AppErrorJson {
    const base: AppErrorJson = {
      name: "AppError",
      code: this.code,
      httpStatus: this.httpStatus,
      severity: this.severity,
      messageZh: this.messageZh,
      messageEn: this.messageEn,
      ...(this.fixSuggestionZh ? { fixSuggestionZh: this.fixSuggestionZh } : {}),
      ...(this.fixSuggestionEn ? { fixSuggestionEn: this.fixSuggestionEn } : {}),
      ...(this.details ? { details: this.details } : {}),
      ...(this.stack ? { stack: this.stack } : {})
    };
    return base;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * 将任意 unknown 转为 AppError：
 * - 已是 AppError 则原样返回
 * - Error 则包装为 CORE_INTERNAL，保留 cause
 * - 其他值字符串化后包装为 CORE_INTERNAL
 */
export function wrapUnknown(e: unknown, code: ErrorCodeKey = ErrorCode.CORE_INTERNAL): AppError {
  if (isAppError(e)) return e;
  if (e instanceof Error) {
    return new AppError(code, { cause: e, messageEn: e.message });
  }
  return new AppError(code, { cause: e, messageEn: String(e) });
}

/**
 * HTTP 错误响应载荷（供 Web API 阶段使用）。
 *
 * **安全策略**：
 * - 默认隐藏 `stack`、`details`、`cause`（防泄漏内部路径/配置/凭据）
 * - `includeStack` / `includeDetails` 仅在 NODE_ENV=development 或显式 debug 模式启用
 * - 详细诊断信息走 logger 而非 HTTP 响应
 */
export function toHttpError(
  e: unknown,
  options: { includeStack?: boolean; includeDetails?: boolean; locale?: "zh" | "en" } = {}
): { status: number; body: Omit<AppErrorJson, "stack" | "details"> & { stack?: string; details?: AppErrorJson["details"] } } {
  const err = isAppError(e) ? e : wrapUnknown(e);
  const json = err.toJSON();
  if (!options.includeStack) {
    delete (json as { stack?: string }).stack;
  }
  if (!options.includeDetails) {
    delete (json as { details?: unknown }).details;
  }
  return { status: err.httpStatus, body: json };
}
