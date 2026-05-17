import type { Storage } from "@mc-forgelab/storage";
import type { AppConfig } from "@mc-forgelab/config";
import type { createArtifactManager } from "@mc-forgelab/artifact-manager";

export interface AppContext {
  storage: Storage;
  artifacts: ReturnType<typeof createArtifactManager>;
  cfg: AppConfig;
}
