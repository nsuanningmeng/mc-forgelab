import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";

const SETTING_KEYS = {
  http: "proxy.http",
  https: "proxy.https",
  auth: "proxy.auth",
  noProxy: "proxy.noProxy",
} as const;

export interface ProxySettings {
  http?: string;
  httpPort?: number;
  https?: string;
  httpsPort?: number;
  username?: string;
  password?: string;
  noProxy?: string;
}

export interface ProxySettingsResponse extends Omit<ProxySettings, "password"> {
  password: boolean;
}

interface StoredProxyEndpoint {
  readonly address?: string;
  readonly port?: number;
}

interface StoredProxyAuth {
  readonly username?: string;
  readonly password?: string;
}

type ProxySettingsPatch = Partial<Record<keyof ProxySettings, unknown>>;
type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(body: ProxySettingsPatch, key: keyof ProxySettings): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function parseStoredObject(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readEndpoint(value: string | undefined): StoredProxyEndpoint {
  const parsed = parseStoredObject(value);
  const address = typeof parsed.address === "string" ? parsed.address : undefined;
  const port = typeof parsed.port === "number" && Number.isInteger(parsed.port) ? parsed.port : undefined;
  return { address, port };
}

function readAuth(value: string | undefined): StoredProxyAuth {
  const parsed = parseStoredObject(value);
  const username = typeof parsed.username === "string" ? parsed.username : undefined;
  const password = typeof parsed.password === "string" ? parsed.password : undefined;
  return { username, password };
}

function validatePatch(body: ProxySettingsPatch): string | undefined {
  for (const field of ["http", "https", "username", "password", "noProxy"] as const) {
    if (hasOwn(body, field) && typeof body[field] !== "string") {
      return `${field} must be a string`;
    }
  }

  for (const field of ["httpPort", "httpsPort"] as const) {
    if (!hasOwn(body, field)) continue;
    const port = body[field];
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      return `${field} must be an integer between 1 and 65535`;
    }
  }

  return undefined;
}

function sanitizeProxyPatch(body: ProxySettingsPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of ["http", "httpPort", "https", "httpsPort", "username", "password", "noProxy"] as const) {
    if (!hasOwn(body, field)) continue;
    payload[field] = field === "password" ? body[field] !== "" : body[field];
  }
  return payload;
}

function upsertSetting(
  ctx: AppContext,
  key: SettingKey,
  value: string,
  previousValue: string | undefined,
  updatedKeys: SettingKey[],
  createdKeys: SettingKey[]
) {
  ctx.storage.setSetting(key, value);
  updatedKeys.push(key);
  if (previousValue === undefined) createdKeys.push(key);
}

export function getProxySettings(ctx: AppContext): ProxySettingsResponse {
  const http = readEndpoint(ctx.storage.getSetting(SETTING_KEYS.http));
  const https = readEndpoint(ctx.storage.getSetting(SETTING_KEYS.https));
  const auth = readAuth(ctx.storage.getSetting(SETTING_KEYS.auth));

  return {
    http: http.address ?? "",
    httpPort: http.port,
    https: https.address ?? "",
    httpsPort: https.port,
    username: auth.username ?? "",
    password: Boolean(auth.password),
    noProxy: ctx.storage.getSetting(SETTING_KEYS.noProxy) ?? "",
  };
}

export async function registerProxyRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/settings/proxy", async () => {
    return getProxySettings(ctx);
  });

  app.patch<{ Body: ProxySettingsPatch }>("/api/settings/proxy", async (req, reply) => {
    const body = req.body ?? {};
    const validationError = validatePatch(body);
    if (validationError) return reply.status(400).send({ error: validationError });

    const updatedKeys: SettingKey[] = [];
    const createdKeys: SettingKey[] = [];

    const currentHttpRaw = ctx.storage.getSetting(SETTING_KEYS.http);
    const currentHttpsRaw = ctx.storage.getSetting(SETTING_KEYS.https);
    const currentAuthRaw = ctx.storage.getSetting(SETTING_KEYS.auth);
    const currentHttp = readEndpoint(currentHttpRaw);
    const currentHttps = readEndpoint(currentHttpsRaw);
    const currentAuth = readAuth(currentAuthRaw);

    if (hasOwn(body, "http") || hasOwn(body, "httpPort")) {
      upsertSetting(ctx, SETTING_KEYS.http, JSON.stringify({
        address: hasOwn(body, "http") ? (body.http as string).trim() : currentHttp.address,
        port: hasOwn(body, "httpPort") ? body.httpPort as number : currentHttp.port,
      }), currentHttpRaw, updatedKeys, createdKeys);
    }

    if (hasOwn(body, "https") || hasOwn(body, "httpsPort")) {
      upsertSetting(ctx, SETTING_KEYS.https, JSON.stringify({
        address: hasOwn(body, "https") ? (body.https as string).trim() : currentHttps.address,
        port: hasOwn(body, "httpsPort") ? body.httpsPort as number : currentHttps.port,
      }), currentHttpsRaw, updatedKeys, createdKeys);
    }

    if (hasOwn(body, "username") || hasOwn(body, "password")) {
      upsertSetting(ctx, SETTING_KEYS.auth, JSON.stringify({
        username: hasOwn(body, "username") ? (body.username as string).trim() : currentAuth.username,
        password: hasOwn(body, "password") ? body.password as string : currentAuth.password,
      }), currentAuthRaw, updatedKeys, createdKeys);
    }

    if (hasOwn(body, "noProxy")) {
      const currentNoProxyRaw = ctx.storage.getSetting(SETTING_KEYS.noProxy);
      upsertSetting(ctx, SETTING_KEYS.noProxy, (body.noProxy as string).trim(), currentNoProxyRaw, updatedKeys, createdKeys);
    }

    if (updatedKeys.length > 0) {
      ctx.auditor.log({
        eventType: "settings.proxy.update",
        entityType: "settings",
        entityId: "proxy",
        payload: { ...sanitizeProxyPatch(body), updatedKeys, createdKeys },
      });
    }

    return getProxySettings(ctx);
  });
}
