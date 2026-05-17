import { AppError, ErrorCode } from "@mc-forgelab/app-error";

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off", ""]);

export function readEnv(env: Readonly<Record<string, string | undefined>>, key: string): string | undefined {
  const v = env[key];
  return v === undefined ? undefined : v.trim();
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const lower = value.toLowerCase();
  if (TRUTHY.has(lower)) return true;
  if (FALSY.has(lower)) return false;
  throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
    details: { reason: "expected boolean", value }
  });
}

const SIZE_RE = /^(\d+(?:\.\d+)?)\s*([kmgt]?b)?$/i;

/**
 * 解析人类可读尺寸字符串为字节数。
 * 接受："200MB" / "2GB" / "20gb" / 纯数字（按字节）。
 */
export function parseSize(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (/^\d+$/.test(value)) return Number(value);
  const m = SIZE_RE.exec(value.trim());
  if (!m || m[1] === undefined) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { reason: "invalid size", value }
    });
  }
  const num = Number(m[1]);
  const unit = (m[2] ?? "B").toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4
  };
  const factor = multipliers[unit];
  if (factor === undefined) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { reason: "unknown size unit", value }
    });
  }
  return Math.floor(num * factor);
}

export function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^-?\d+$/.test(value)) {
    throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
      details: { reason: "expected integer", value }
    });
  }
  return Number(value);
}

export function parseLogLevel(
  value: string | undefined,
  fallback: "trace" | "debug" | "info" | "warn" | "error" | "fatal"
): "trace" | "debug" | "info" | "warn" | "error" | "fatal" {
  if (value === undefined || value === "") return fallback;
  const lower = value.toLowerCase();
  const allowed = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  if ((allowed as readonly string[]).includes(lower)) {
    return lower as (typeof allowed)[number];
  }
  throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
    details: { reason: "unknown log level", value }
  });
}

export function parseMode(
  value: string | undefined,
  fallback: "cli" | "web" | "desktop" | "docker"
): "cli" | "web" | "desktop" | "docker" {
  if (value === undefined || value === "") return fallback;
  const lower = value.toLowerCase();
  if (lower === "cli" || lower === "web" || lower === "desktop" || lower === "docker") return lower;
  throw new AppError(ErrorCode.CONFIG_INVALID_VALUE, {
    details: { reason: "unknown mode", value }
  });
}
