import { resolve, normalize, isAbsolute, sep } from "node:path";

/**
 * 路径穿越保护错误。
 * 所有 user-supplied 路径都必须经过 resolveInsideBase 解析，
 * 触发此错误意味着尝试逃逸 base 沙箱。
 */
export class PathEscapeError extends Error {
  override readonly name = "PathEscapeError";
  constructor(
    public readonly input: string,
    public readonly base: string
  ) {
    super(`Path "${input}" escapes base directory "${base}"`);
  }
}

/**
 * 将相对/绝对路径限制在 base 目录内，返回 resolved 绝对路径。
 * - 若 input 解析后位于 base 之外，抛 PathEscapeError。
 * - 不做 realpath 解析，符号链接需由调用方在 IO 层补充校验。
 */
export function resolveInsideBase(base: string, input: string): string {
  const absoluteBase = normalizeSlashes(resolve(base));
  const candidate = normalizeSlashes(
    isAbsolute(input) ? normalize(input) : resolve(absoluteBase, input)
  );

  const baseWithSep = absoluteBase.endsWith(sep) ? absoluteBase : `${absoluteBase}${sep}`;
  if (candidate !== absoluteBase && !candidate.startsWith(baseWithSep)) {
    throw new PathEscapeError(input, absoluteBase);
  }
  return candidate;
}

/** 仅检查不抛异常 */
export function isPathInsideBase(base: string, input: string): boolean {
  try {
    resolveInsideBase(base, input);
    return true;
  } catch {
    return false;
  }
}

/** 跨平台统一斜杠为系统分隔符（不改变绝对性） */
export function normalizeSlashes(p: string): string {
  return normalize(p);
}

const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
]);

// 非法字符：反斜杠、正斜杠、冒号、星号、问号、双引号、尖括号、竖线
const ILLEGAL_FILENAME_CHARS = new RegExp("[\\\\/:*?\"<>|]");

function hasControlChar(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 32) return true;
  }
  return false;
}

/**
 * 单段文件名安全校验：禁止 ../、控制字符、Windows 保留名、结尾点/空格。
 * 调用方应先 split 路径，逐段校验。
 */
export function isSafeFileName(name: string): boolean {
  if (name.length === 0 || name.length > 255) return false;
  if (name === "." || name === "..") return false;
  if (ILLEGAL_FILENAME_CHARS.test(name)) return false;
  if (hasControlChar(name)) return false;
  if (/[. ]$/.test(name)) return false;
  const stem = name.split(".")[0]?.toUpperCase() ?? "";
  if (WINDOWS_RESERVED.has(stem)) return false;
  return true;
}
