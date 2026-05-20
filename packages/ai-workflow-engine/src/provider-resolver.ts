import type {
  ModelProfileRecord,
  ModelRole,
  ProviderAdapter,
  ProviderManager
} from "@mc-forgelab/ai-provider-manager";
import type { WorkflowStepDef } from "./types.js";
import { resolveModelRole } from "./types.js";

export interface ResolvedProvider {
  readonly adapter: ProviderAdapter;
  readonly profile: ModelProfileRecord;
  readonly profileId: string | null;
  readonly providerId: string;
  readonly model: string;
}

export interface ProviderResolver {
  resolve(step: WorkflowStepDef, runProviderId?: string | null, runModel?: string | null): ResolvedProvider | null;
}

const MODEL_PROFILE_ROLE_ALIASES: Readonly<Record<string, ModelRole>> = {
  generalModel: "general",
  plannerModel: "planner",
  architectModel: "architect",
  codeModel: "coder",
  reviewModel: "reviewer",
  fixModel: "fixer",
  docModel: "docs",
  summarizerModel: "summarizer"
};

const MODEL_ROLES = new Set<string>([
  "general",
  "planner",
  "architect",
  "coder",
  "reviewer",
  "fixer",
  "docs",
  "summarizer"
]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function roleFromModelProfile(value: string): ModelRole | undefined {
  const aliased = MODEL_PROFILE_ROLE_ALIASES[value];
  if (aliased) return aliased;
  return MODEL_ROLES.has(value) ? value as ModelRole : undefined;
}

function toResolvedProvider(providers: ProviderManager, profile: ModelProfileRecord): ResolvedProvider {
  return {
    adapter: providers.getAdapterForProfile(profile.id),
    profile,
    profileId: profile.id,
    providerId: profile.providerId,
    model: profile.model
  };
}

function createRuntimeProfile(step: WorkflowStepDef, providerId: string, model: string): ModelProfileRecord {
  return {
    id: "run-selection",
    name: "Run selected model",
    providerId,
    model,
    role: resolveModelRole(step.role) ?? "general",
    temperature: 0.2,
    maxTokens: 4096,
    topP: 1,
    timeoutMs: 60000,
    systemPrompt: null,
    enabled: true,
    createdAt: "",
    updatedAt: ""
  };
}

export function createProviderResolver(providers?: ProviderManager): ProviderResolver {
  return {
    resolve(step, runProviderId, runModel) {
      if (!providers) return null;

      const modelProfile = step.modelProfile?.trim();
      if (modelProfile) {
        if (isUuid(modelProfile)) {
          const profile = providers.getProfile(modelProfile);
          if (!profile.enabled) return null;
          return toResolvedProvider(providers, profile);
        }

        const role = roleFromModelProfile(modelProfile);
        if (role) {
          const profile = providers.getProfileByRole(role);
          if (profile) return toResolvedProvider(providers, profile);
        }
      } else {
        const role = resolveModelRole(step.role);
        if (role) {
          const profile = providers.getProfileByRole(role);
          if (profile) return toResolvedProvider(providers, profile);
        }
      }

      const providerId = runProviderId?.trim();
      if (providerId) {
        const provider = providers.getProvider(providerId);
        const model = runModel?.trim() || provider.defaultModel;
        return {
          adapter: providers.getAdapter(provider.id),
          profile: createRuntimeProfile(step, provider.id, model),
          profileId: null,
          providerId: provider.id,
          model
        };
      }

      return null;
    }
  };
}
