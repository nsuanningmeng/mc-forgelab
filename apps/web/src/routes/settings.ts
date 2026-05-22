import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";

const SETTING_KEYS = {
  workspacePath: "workspace.path",
  maxArtifactStorageBytes: "limits.maxArtifactStorageBytes",
  artifactRetentionDays: "limits.artifactRetentionDays",
} as const;

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
