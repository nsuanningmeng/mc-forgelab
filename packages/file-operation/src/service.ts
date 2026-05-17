import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, readdirSync, statSync, existsSync, realpathSync, lstatSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import { resolveInsideBase, validatePatch, type FilePatch } from "./patch.js";

export interface FileOperationService {
  readFile(workspaceRoot: string, path: string): string;
  listFiles(workspaceRoot: string, dir?: string): string[];
  createFile(workspaceRoot: string, path: string, content: string): void;
  updateFile(workspaceRoot: string, path: string, content: string): void;
  deleteFile(workspaceRoot: string, path: string): void;
  moveFile(workspaceRoot: string, path: string, newPath: string): void;
  applyPatch(workspaceRoot: string, patch: FilePatch): { applied: number; errors: string[] };
}

export function createFileOperationService(): FileOperationService {
  return {
    readFile(root, path) {
      const abs = resolveInsideBase(root, path);
      // Verify realpath stays inside root (symlink escape prevention)
      try { const real = realpathSync(abs); if (relative(root, real).startsWith("..")) throw new Error(); } catch { throw new AppError(ErrorCode.FILE_OP_PATH_UNSAFE, { details: { path } }); }
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      return readFileSync(abs, "utf8");
    },

    listFiles(root, dir = "") {
      const abs = resolveInsideBase(root, dir || ".");
      const results: string[] = [];
      function walk(current: string, prefix: string) {
        for (const entry of readdirSync(current)) {
          const full = join(current, entry);
          const rel = prefix ? `${prefix}/${entry}` : entry;
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
      const abs = resolveInsideBase(root, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    },

    updateFile(root, path, content) {
      const abs = resolveInsideBase(root, path);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      writeFileSync(abs, content, "utf8");
    },

    deleteFile(root, path) {
      const abs = resolveInsideBase(root, path);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      rmSync(abs, { recursive: true });
    },

    moveFile(root, path, newPath) {
      const abs = resolveInsideBase(root, path);
      const absNew = resolveInsideBase(root, newPath);
      if (!existsSync(abs)) throw new AppError(ErrorCode.FILE_OP_NOT_FOUND, { details: { path } });
      mkdirSync(dirname(absNew), { recursive: true });
      renameSync(abs, absNew);
    },

    applyPatch(root, patch) {
      const validation = validatePatch(patch, root);
      if (!validation.valid) {
        throw new AppError(ErrorCode.FILE_OP_PATCH_INVALID, { details: { errors: validation.errors } });
      }
      let applied = 0;
      const errors: string[] = [];
      for (const op of patch.operations) {
        try {
          if (op.op === "create" || op.op === "update") {
            const abs = resolveInsideBase(root, op.path);
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, op.content ?? "", "utf8");
          } else if (op.op === "delete") {
            this.deleteFile(root, op.path);
          } else if (op.op === "move" && op.newPath) {
            this.moveFile(root, op.path, op.newPath);
          }
          applied++;
        } catch (e) {
          errors.push(`${op.op} ${op.path}: ${(e as Error).message}`);
        }
      }
      return { applied, errors };
    }
  };
}
