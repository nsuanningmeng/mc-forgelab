import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, readdirSync, existsSync, realpathSync, lstatSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import { resolveInsideBase, validatePatch, type FilePatch } from "./patch.js";

export interface FileOperationApplyPatchOptions {
  readonly signal?: AbortSignal;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("Operation aborted");
}

function isPathInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function realpathExistingParent(abs: string): string {
  let current = dirname(abs);

  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("No existing parent directory");
    }
    current = parent;
  }

  return realpathSync(current);
}

function assertSafePath(root: string, path: string): string {
  const abs = resolveInsideBase(root, path);

  try {
    const realRoot = realpathSync(root);

    if (existsSync(abs)) {
      const real = realpathSync(abs);
      if (!isPathInsideRoot(realRoot, real)) {
        throw new Error("Path escapes workspace root");
      }
    }

    const realParent = realpathExistingParent(abs);
    if (!isPathInsideRoot(realRoot, realParent)) {
      throw new Error("Parent directory escapes workspace root");
    }
  } catch {
    throw new AppError(ErrorCode.FILE_OP_PATH_UNSAFE, { details: { path } });
  }

  return abs;
}

interface PatchBackup {
  readonly backups: Map<string, string>;
  readonly missingPaths: Set<string>;
  readonly warnings: string[];
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function backupPatchPath(
  root: string,
  path: string,
  backups: Map<string, string>,
  missingPaths: Set<string>,
  warnings: string[]
): void {
  let abs: string;
  try {
    abs = assertSafePath(root, path);
  } catch (error) {
    warnings.push(`Unable to resolve backup path ${path}: ${errMsg(error)}`);
    return;
  }

  if (backups.has(abs) || missingPaths.has(abs)) return;
  if (!existsSync(abs)) {
    missingPaths.add(abs);
    return;
  }

  try {
    backups.set(abs, readFileSync(abs, "utf8"));
  } catch (error) {
    warnings.push(`Unable to backup ${path}: ${errMsg(error)}`);
  }
}

function createPatchBackup(root: string, patch: FilePatch): PatchBackup {
  const backups = new Map<string, string>();
  const missingPaths = new Set<string>();
  const warnings: string[] = [];

  for (const op of patch.operations) {
    backupPatchPath(root, op.path, backups, missingPaths, warnings);
    if (op.op === "move" && op.newPath) {
      backupPatchPath(root, op.newPath, backups, missingPaths, warnings);
    }
  }

  return { backups, missingPaths, warnings };
}

function restorePatchBackup(backup: PatchBackup): string[] {
  const errors: string[] = [];

  for (const abs of backup.missingPaths) {
    try {
      if (existsSync(abs)) rmSync(abs, { recursive: true, force: true });
    } catch (error) {
      errors.push(`rollback remove failed: ${errMsg(error)}`);
    }
  }

  for (const [abs, content] of backup.backups) {
    try {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    } catch (error) {
      errors.push(`rollback restore failed: ${errMsg(error)}`);
    }
  }

  return errors;
}

export interface FileOperationService {
  readFile(workspaceRoot: string, path: string): string;
  listFiles(workspaceRoot: string, dir?: string): string[];
  createFile(workspaceRoot: string, path: string, content: string): void;
  updateFile(workspaceRoot: string, path: string, content: string): void;
  deleteFile(workspaceRoot: string, path: string): void;
  moveFile(workspaceRoot: string, path: string, newPath: string): void;
  applyPatch(workspaceRoot: string, patch: FilePatch, options?: FileOperationApplyPatchOptions): { applied: number; errors: string[] };
}

export function createFileOperationService(): FileOperationService {
  return {
    readFile(root, path) {
      const abs = assertSafePath(root, path);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      return readFileSync(abs, "utf8");
    },

    listFiles(root, dir = "") {
      const abs = resolveInsideBase(root, dir || ".");
      const results: string[] = [];
      function walk(current: string, prefix: string) {
        for (const entry of readdirSync(current)) {
          const full = join(current, entry);
          const rel = prefix ? join(prefix, entry) : entry;
          try {
            const lst = lstatSync(full);
            if (lst.isSymbolicLink()) continue; // skip symlinks
            if (lst.isDirectory()) walk(full, rel);
            else results.push(rel);
          } catch { /* skip */ }
        }
      }
      if (existsSync(abs)) walk(abs, dir);
      return results;
    },

    createFile(root, path, content) {
      const abs = assertSafePath(root, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    },

    updateFile(root, path, content) {
      const abs = assertSafePath(root, path);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      writeFileSync(abs, content, "utf8");
    },

    deleteFile(root, path) {
      const abs = assertSafePath(root, path);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      rmSync(abs, { recursive: true });
    },

    moveFile(root, path, newPath) {
      const abs = assertSafePath(root, path);
      const absNew = assertSafePath(root, newPath);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      mkdirSync(dirname(absNew), { recursive: true });
      renameSync(abs, absNew);
    },

    applyPatch(root, patch, options = {}) {
      throwIfAborted(options.signal);
      const validation = validatePatch(patch, root);
      if (!validation.valid) {
        throw new AppError(ErrorCode.FILE_OP_PATCH_INVALID, { details: { errors: validation.errors } });
      }
      let applied = 0;
      const backup = createPatchBackup(root, patch);
      const errors: string[] = [];

      for (const warning of backup.warnings) {
        // eslint-disable-next-line no-console
        console.warn(`[mc-forgelab] WARNING: ${warning}`);
      }

      for (const op of patch.operations) {
        try {
          throwIfAborted(options.signal);
          if (op.op === "create") {
            this.createFile(root, op.path, op.content ?? "");
          } else if (op.op === "update") {
            this.updateFile(root, op.path, op.content ?? "");
          } else if (op.op === "delete") {
            this.deleteFile(root, op.path);
          } else if (op.op === "move" && op.newPath) {
            this.moveFile(root, op.path, op.newPath);
          }
          applied++;
        } catch (e) {
          errors.push(`${op.op} ${op.path}: ${errMsg(e)}`);
          break;
        }
      }

      if (errors.length > 0) {
        errors.push(...restorePatchBackup(backup));
        return { applied: 0, errors };
      }

      return { applied, errors };
    }
  };
}
