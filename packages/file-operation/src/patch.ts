import { resolve, normalize, relative, isAbsolute, sep } from "node:path";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";

const MAX_FILE_SIZE = 300 * 1024; // 300KB

export type PatchOp = "create" | "update" | "delete" | "move";

export interface FilePatchOperation {
  readonly op: PatchOp;
  readonly path: string;
  readonly content?: string;
  readonly newPath?: string;
}

export interface FilePatch {
  readonly type: "file_patch";
  readonly summary: string;
  readonly operations: readonly FilePatchOperation[];
  readonly notes?: readonly string[];
}

export interface PatchValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/** Vérifie qu'un chemin est à l'intérieur du répertoire de base (pas de path traversal). */
export function resolveInsideBase(base: string, input: string): string {
  if (isAbsolute(input)) {
    throw new AppError(ErrorCode.FILE_OP_PATH_UNSAFE, { details: { path: input, reason: "absolute path" } });
  }
  const resolved = resolve(base, normalize(input));
  const rel = relative(base, resolved);
  if (rel.startsWith("..") || rel.startsWith(sep + "..")) {
    throw new AppError(ErrorCode.FILE_OP_PATH_UNSAFE, { details: { path: input, reason: "path traversal" } });
  }
  return resolved;
}

const DANGEROUS_PATTERNS = [
  /\.\.[/\\]/,
  /^[/\\]/,
  /\0/,
  /\beval\s*\(/,
  /Runtime\.exec\s*\(/,
  /ProcessBuilder/,
  /System\.exit/
];

/** Valide un FilePatch avant application. */
export function validatePatch(patch: FilePatch, workspaceRoot: string): PatchValidationResult {
  const errors: string[] = [];

  if (!patch.type || patch.type !== "file_patch") {
    errors.push("patch.type must be 'file_patch'");
  }
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    errors.push("patch.operations must be a non-empty array");
  }
  if (patch.operations.length > 50) {
    errors.push(`Too many operations: ${patch.operations.length} (max 50)`);
  }

  for (const op of patch.operations ?? []) {
    try {
      resolveInsideBase(workspaceRoot, op.path);
    } catch {
      errors.push(`Unsafe path: ${op.path}`);
    }

    if (op.content !== undefined) {
      if (op.content.length > MAX_FILE_SIZE) {
        errors.push(`File too large: ${op.path} (${op.content.length} chars, max ${MAX_FILE_SIZE})`);
      }
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(op.path)) {
          errors.push(`Dangerous pattern in path: ${op.path}`);
          break;
        }
      }
    }

    if (op.op === "move" && !op.newPath) {
      errors.push(`move operation requires newPath: ${op.path}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
