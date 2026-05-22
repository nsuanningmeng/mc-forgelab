import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { AppContext } from "./types.js";

const SETTING_KEYS = {
  workspacePath: "workspace.path",
  maxArtifactStorageBytes: "limits.maxArtifactStorageBytes",
  artifactRetentionDays: "limits.artifactRetentionDays",
  adminPasswordHash: "auth.adminPasswordHash",
} as const;

type AuthSource = "settings" | "env" | "none";

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function getAuthSettings(ctx: AppContext): { enabled: boolean; adminUser: string | null; passwordConfigured: boolean; source: AuthSource } {
  const storedHash = ctx.storage.getSetting(SETTING_KEYS.adminPasswordHash);
  const envPassword = process.env.MC_FORGELAB_ADMIN_PASSWORD;
  const source: AuthSource = storedHash ? "settings" : envPassword ? "env" : "none";
  return {
    enabled: ctx.cfg.auth.enabled,
    adminUser: ctx.cfg.auth.adminUser,
    passwordConfigured: source !== "none",
    source,
  };
}

async function verifyCurrentPassword(candidate: string | undefined, storedHash: string | undefined, envPassword: string | undefined): Promise<boolean> {
  if (!candidate) return false;
  if (storedHash) return verifyPassword(candidate, storedHash);
  if (envPassword) return safeEqualString(candidate, envPassword);
  return true;
}

export function getWorkspaceSettings(ctx: AppContext) {
  const path = ctx.storage.getSetting(SETTING_KEYS.workspacePath) ?? ctx.cfg.paths.workspace;
  const maxStorage = ctx.storage.getSetting(SETTING_KEYS.maxArtifactStorageBytes);
  const retention = ctx.storage.getSetting(SETTING_KEYS.artifactRetentionDays);

  return {
    workspacePath: path,
    maxArtifactStorageBytes: maxStorage ? Number(maxStorage) : ctx.cfg.limits.maxArtifactStorageBytes,
    artifactRetentionDays: retention ? Number(retention) : ctx.cfg.limits.artifactRetentionDays,
  };
}

export async function registerSettingsRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/settings/workspace", async () => {
    return getWorkspaceSettings(ctx);
  });

  app.get("/api/settings/auth", async () => {
    return getAuthSettings(ctx);
  });

  app.patch<{ Body: { currentPassword?: string; newPassword?: string } }>("/api/settings/auth", async (req, reply) => {
    const body = req.body ?? {};
    if (typeof body.newPassword !== "string" || body.newPassword.length < 12) {
      return reply.status(400).send({ error: "newPassword must be at least 12 characters" });
    }

    const before = getAuthSettings(ctx);
    const storedHash = ctx.storage.getSetting(SETTING_KEYS.adminPasswordHash);
    const envPassword = process.env.MC_FORGELAB_ADMIN_PASSWORD;
    if ((storedHash || envPassword) && !(await verifyCurrentPassword(body.currentPassword, storedHash, envPassword))) {
      return reply.status(401).send({ error: "currentPassword is invalid" });
    }

    ctx.storage.setSetting(SETTING_KEYS.adminPasswordHash, await hashPassword(body.newPassword));
    ctx.auditor.log({
      eventType: "settings.auth.update",
      entityType: "settings",
      entityId: "auth",
      payload: { passwordConfigured: true, previousSource: before.source },
    });

    return getAuthSettings(ctx);
  });

  app.patch<{ Body: {
    workspacePath?: string;
    maxArtifactStorageBytes?: number;
    artifactRetentionDays?: number;
  } }>("/api/settings/workspace", async (req, reply) => {
    const body = req.body ?? {};

    if (body.workspacePath !== undefined) {
      if (typeof body.workspacePath !== "string" || body.workspacePath.trim().length === 0) {
        return reply.status(400).send({ error: "workspacePath must be a non-empty string" });
      }
      ctx.storage.setSetting(SETTING_KEYS.workspacePath, body.workspacePath.trim());
    }

    if (body.maxArtifactStorageBytes !== undefined) {
      if (typeof body.maxArtifactStorageBytes !== "number" || !Number.isFinite(body.maxArtifactStorageBytes) || body.maxArtifactStorageBytes < 0) {
        return reply.status(400).send({ error: "maxArtifactStorageBytes must be a positive number" });
      }
      ctx.storage.setSetting(SETTING_KEYS.maxArtifactStorageBytes, String(Math.floor(body.maxArtifactStorageBytes)));
    }

    if (body.artifactRetentionDays !== undefined) {
      if (typeof body.artifactRetentionDays !== "number" || !Number.isFinite(body.artifactRetentionDays) || body.artifactRetentionDays < 1) {
        return reply.status(400).send({ error: "artifactRetentionDays must be a positive integer" });
      }
      ctx.storage.setSetting(SETTING_KEYS.artifactRetentionDays, String(Math.floor(body.artifactRetentionDays)));
    }

    ctx.auditor.log({
      eventType: "settings.workspace.update",
      entityType: "settings",
      entityId: "workspace",
      payload: body,
    });

    return getWorkspaceSettings(ctx);
  });
}
