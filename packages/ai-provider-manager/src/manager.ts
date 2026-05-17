import { randomUUID } from "node:crypto";
import { AppError, ErrorCode } from "@mc-forgelab/app-error";
import type { Logger } from "@mc-forgelab/logger";
import type { Storage } from "@mc-forgelab/storage";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./crypto.js";
import { createOpenAICompatAdapter } from "./openai-compat.js";
import type {
  ProviderRecord, ModelProfileRecord, ModelRole, ProviderAdapter,
  ConnectionTestResult, ModelInfo
} from "./types.js";

const ENCRYPTION_SECRET = "mc-forgelab-provider-secret-v1";

export interface CreateProviderInput {
  displayName: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  availableModels?: string[];
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface CreateProfileInput {
  name: string;
  providerId: string;
  model: string;
  role: ModelRole;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  systemPrompt?: string | null;
}

export interface ProviderManager {
  listProviders(): ProviderRecord[];
  getProvider(id: string): ProviderRecord;
  createProvider(input: CreateProviderInput): ProviderRecord;
  updateProvider(id: string, input: Partial<CreateProviderInput>): ProviderRecord;
  deleteProvider(id: string): void;
  testProvider(id: string): Promise<ConnectionTestResult>;
  listModels(id: string): Promise<ModelInfo[]>;
  getAdapter(id: string): ProviderAdapter;
  getAdapterForProfile(profileId: string): ProviderAdapter;

  listProfiles(): ModelProfileRecord[];
  getProfile(id: string): ModelProfileRecord;
  getProfileByRole(role: ModelRole): ModelProfileRecord | undefined;
  createProfile(input: CreateProfileInput): ModelProfileRecord;
  updateProfile(id: string, input: Partial<CreateProfileInput>): ModelProfileRecord;
  deleteProfile(id: string): void;
  ensureDefaultProfiles(providerId: string, model: string): void;
}

export function createProviderManager(storage: Storage, logger?: Logger): ProviderManager {
  function rowToProvider(row: Record<string, unknown>): ProviderRecord {
    return {
      id: row.id as string,
      displayName: row.display_name as string,
      type: "openai-compatible",
      baseUrl: row.base_url as string,
      apiKeyEncrypted: row.api_key_encrypted as string,
      defaultModel: row.default_model as string,
      availableModels: JSON.parse((row.available_models as string) || "[]") as string[],
      customHeaders: JSON.parse((row.custom_headers as string) || "{}") as Record<string, string>,
      customQueryParams: {},
      timeoutMs: (row.timeout_ms as number) ?? 60000,
      maxRetries: 3,
      proxyUrl: null,
      enableStreaming: true,
      enableToolCalling: true,
      enableJsonMode: true,
      enableVision: false,
      enabled: (row.enabled as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  function rowToProfile(row: Record<string, unknown>): ModelProfileRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      providerId: row.provider_id as string,
      model: row.model as string,
      role: row.role as ModelRole,
      temperature: (row.temperature as number) ?? 0.2,
      maxTokens: (row.max_tokens as number) ?? 4096,
      topP: (row.top_p as number) ?? 1.0,
      timeoutMs: (row.timeout_ms as number) ?? 60000,
      systemPrompt: (row.system_prompt as string | null) ?? null,
      enabled: (row.enabled as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  return {
    listProviders() {
      const rows = storage.backend.all<Record<string, unknown>>("SELECT * FROM ai_providers ORDER BY created_at");
      return rows.map(rowToProvider);
    },

    getProvider(id) {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM ai_providers WHERE id = ?", [id]);
      if (!row) throw new AppError(ErrorCode.AI_PROVIDER_NOT_FOUND, { details: { id } });
      return rowToProvider(row);
    },

    createProvider(input) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const encrypted = encryptApiKey(input.apiKey, ENCRYPTION_SECRET);
      logger?.debug("Creating AI provider", { id, displayName: input.displayName, baseUrl: input.baseUrl, apiKey: maskApiKey(input.apiKey) });
      storage.backend.run(
        `INSERT INTO ai_providers (id, display_name, type, base_url, api_key_encrypted, default_model, available_models, custom_headers, timeout_ms, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.displayName, "openai-compatible", input.baseUrl, encrypted, input.defaultModel,
         JSON.stringify(input.availableModels ?? []), JSON.stringify(input.customHeaders ?? {}),
         input.timeoutMs ?? 60000, input.enabled !== false ? 1 : 0, now, now]
      );
      return this.getProvider(id);
    },

    updateProvider(id, input) {
      const existing = this.getProvider(id);
      const now = new Date().toISOString();
      const encrypted = input.apiKey ? encryptApiKey(input.apiKey, ENCRYPTION_SECRET) : existing.apiKeyEncrypted;
      storage.backend.run(
        `UPDATE ai_providers SET display_name=?, base_url=?, api_key_encrypted=?, default_model=?, available_models=?, custom_headers=?, timeout_ms=?, enabled=?, updated_at=? WHERE id=?`,
        [input.displayName ?? existing.displayName, input.baseUrl ?? existing.baseUrl, encrypted,
         input.defaultModel ?? existing.defaultModel, JSON.stringify(input.availableModels ?? existing.availableModels),
         JSON.stringify(input.customHeaders ?? existing.customHeaders), input.timeoutMs ?? existing.timeoutMs,
         existing.enabled ? 1 : 0, now, id]
      );
      return this.getProvider(id);
    },

    deleteProvider(id) {
      this.getProvider(id);
      storage.backend.run("DELETE FROM ai_providers WHERE id = ?", [id]);
    },

    getAdapter(id) {
      const p = this.getProvider(id);
      if (!p.enabled) throw new AppError(ErrorCode.AI_PROVIDER_DISABLED, { details: { id } });
      const apiKey = decryptApiKey(p.apiKeyEncrypted, ENCRYPTION_SECRET);
      return createOpenAICompatAdapter({
        baseUrl: p.baseUrl, apiKey, defaultModel: p.defaultModel,
        customHeaders: p.customHeaders as Record<string, string>, timeoutMs: p.timeoutMs
      });
    },

    getAdapterForProfile(profileId) {
      const profile = this.getProfile(profileId);
      return this.getAdapter(profile.providerId);
    },

    async testProvider(id) {
      return this.getAdapter(id).testConnection();
    },

    async listModels(id) {
      return this.getAdapter(id).listModels();
    },

    listProfiles() {
      const rows = storage.backend.all<Record<string, unknown>>("SELECT * FROM model_profiles ORDER BY role, created_at");
      return rows.map(rowToProfile);
    },

    getProfile(id) {
      const row = storage.backend.get<Record<string, unknown>>("SELECT * FROM model_profiles WHERE id = ?", [id]);
      if (!row) throw new AppError(ErrorCode.AI_PROVIDER_NOT_FOUND, { details: { id, type: "profile" } });
      return rowToProfile(row);
    },

    getProfileByRole(role) {
      const row = storage.backend.get<Record<string, unknown>>(
        "SELECT * FROM model_profiles WHERE role = ? AND enabled = 1 ORDER BY created_at LIMIT 1", [role]
      );
      return row ? rowToProfile(row) : undefined;
    },

    createProfile(input) {
      const id = randomUUID();
      const now = new Date().toISOString();
      storage.backend.run(
        `INSERT INTO model_profiles (id, name, provider_id, model, role, temperature, max_tokens, top_p, timeout_ms, system_prompt, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, input.name, input.providerId, input.model, input.role,
         input.temperature ?? 0.2, input.maxTokens ?? 4096, input.topP ?? 1.0,
         input.timeoutMs ?? 60000, input.systemPrompt ?? null, now, now]
      );
      return this.getProfile(id);
    },

    updateProfile(id, input) {
      const existing = this.getProfile(id);
      const now = new Date().toISOString();
      storage.backend.run(
        `UPDATE model_profiles SET name=?, provider_id=?, model=?, role=?, temperature=?, max_tokens=?, top_p=?, timeout_ms=?, system_prompt=?, updated_at=? WHERE id=?`,
        [input.name ?? existing.name, input.providerId ?? existing.providerId, input.model ?? existing.model,
         input.role ?? existing.role, input.temperature ?? existing.temperature, input.maxTokens ?? existing.maxTokens,
         input.topP ?? existing.topP, input.timeoutMs ?? existing.timeoutMs,
         input.systemPrompt !== undefined ? input.systemPrompt : existing.systemPrompt, now, id]
      );
      return this.getProfile(id);
    },

    deleteProfile(id) {
      this.getProfile(id);
      storage.backend.run("DELETE FROM model_profiles WHERE id = ?", [id]);
    },

    ensureDefaultProfiles(providerId, model) {
      const roles: Array<{ role: ModelRole; name: string; temperature: number; maxTokens: number }> = [
        { role: "general", name: "通用模型", temperature: 0.7, maxTokens: 4096 },
        { role: "planner", name: "规划模型", temperature: 0.2, maxTokens: 4096 },
        { role: "architect", name: "架构模型", temperature: 0.2, maxTokens: 4096 },
        { role: "coder", name: "代码生成模型", temperature: 0.1, maxTokens: 8192 },
        { role: "reviewer", name: "代码审查模型", temperature: 0.1, maxTokens: 4096 },
        { role: "fixer", name: "错误修复模型", temperature: 0.1, maxTokens: 8192 },
        { role: "docs", name: "文档生成模型", temperature: 0.3, maxTokens: 4096 },
        { role: "summarizer", name: "总结模型", temperature: 0.3, maxTokens: 2048 }
      ];
      for (const r of roles) {
        const existing = this.getProfileByRole(r.role);
        if (!existing) {
          this.createProfile({ ...r, providerId, model });
        }
      }
    }
  };
}
