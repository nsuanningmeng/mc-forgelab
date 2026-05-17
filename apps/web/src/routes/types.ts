import type { Storage } from "@mc-forgelab/storage";
import type { AppConfig } from "@mc-forgelab/config";
import type { createArtifactManager } from "@mc-forgelab/artifact-manager";
import type { ProviderManager } from "@mc-forgelab/ai-provider-manager";
import type { BuildRegistry } from "../lib/build-registry.js";
import type { AuditLogger } from "../lib/audit.js";

export interface AppContext {
  storage: Storage;
  artifacts: ReturnType<typeof createArtifactManager>;
  cfg: AppConfig;
  providers: ProviderManager;
  builds: BuildRegistry;
  auditor: AuditLogger;
}
