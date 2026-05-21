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

const PATCH_OPS = new Set<PatchOp>(["create", "update", "delete", "move"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function throwInvalidPatch(errors: string[]): never {
  throw new AppError(ErrorCode.FILE_OP_PATCH_INVALID, { details: { errors } });
}

export function parseFilePatch(raw: unknown): FilePatch {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    throwInvalidPatch(["patch must be an object"]);
  }

  if (raw.type !== "file_patch") {
    errors.push("patch.type must be 'file_patch'");
  }

  const summary = raw.summary;
  if (typeof summary !== "string") {
    errors.push("patch.summary must be a string");
  }

  let notes: string[] | undefined;
  if (raw.notes !== undefined) {
    if (!Array.isArray(raw.notes) || raw.notes.some((note: unknown) => typeof note !== "string")) {
      errors.push("patch.notes must be an array of strings");
    } else {
      notes = raw.notes as string[];
    }
  }

  const operations: FilePatchOperation[] = [];
  if (!Array.isArray(raw.operations)) {
    errors.push("patch.operations must be an array");
  } else {
    raw.operations.forEach((operation: unknown, index: number) => {
      if (!isRecord(operation)) {
        errors.push(`patch.operations[${index}] must be an object`);
        return;
      }

      const opValue = operation.op;
      const pathValue = operation.path;
      const op = typeof opValue === "string" && PATCH_OPS.has(opValue as PatchOp) ? opValue as PatchOp : undefined;
      const path = isNonBlankString(pathValue) ? pathValue : undefined;
      const content = operation.content;
      const newPath = operation.newPath;
      const hasContent = hasOwn(operation, "content");
      const hasNewPath = hasOwn(operation, "newPath");

      if (!op) errors.push(`patch.operations[${index}].op must be one of: create, update, delete, move`);
      if (!path) errors.push(`patch.operations[${index}].path must be a non-empty string`);
      if (hasContent && typeof content !== "string") errors.push(`patch.operations[${index}].content must be a string`);
      if (hasNewPath && typeof newPath !== "string") errors.push(`patch.operations[${index}].newPath must be a string`);

      if (op === "create" || op === "update") {
        if (!hasContent) {
          errors.push(`patch.operations[${index}].content is required for ${op}`);
        } else if (typeof content === "string" && content.length === 0) {
          errors.push(`patch.operations[${index}].content must be non-empty for ${op}`);
        }
        if (hasNewPath) {
          errors.push(`patch.operations[${index}].newPath is not allowed for ${op}`);
        }
      } else if (op === "delete") {
        if (hasContent) errors.push(`patch.operations[${index}].content is not allowed for delete`);
        if (hasNewPath) errors.push(`patch.operations[${index}].newPath is not allowed for delete`);
      } else if (op === "move") {
        if (!hasNewPath) {
          errors.push(`patch.operations[${index}].newPath is required for move`);
        } else if (typeof newPath === "string" && newPath.trim().length === 0) {
          errors.push(`patch.operations[${index}].newPath must be a non-empty string for move`);
        }
        if (hasContent) {
          errors.push(`patch.operations[${index}].content is not allowed for move`);
        }
      }

      if (op && path) {
        operations.push({
          op, path,
          ...(typeof content === "string" ? { content } : {}),
          ...(typeof newPath === "string" ? { newPath } : {})
        });
      }
    });
  }

  if (errors.length > 0) throwInvalidPatch(errors);
  return { type: "file_patch", summary: summary as string, operations, ...(notes ? { notes } : {}) };
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

    if (op.op === "move") {
      if (!op.newPath) {
        errors.push(`move operation requires newPath: ${op.path}`);
      } else {
        try {
          resolveInsideBase(workspaceRoot, op.newPath);
        } catch {
          errors.push(`Unsafe newPath: ${op.newPath}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
