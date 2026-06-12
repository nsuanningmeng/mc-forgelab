import type { FullConfig } from '@playwright/test';

/**
 * Safety guard: e2e tests create/delete projects, providers, and profiles.
 * Refuse to run against any server with persistent storage so test data can
 * never leak into a real user database (the "phantom projects" bug).
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('e2e global-setup: baseURL is not configured');

  const res = await fetch(`${baseURL}/api/health`);
  if (!res.ok) {
    throw new Error(`e2e global-setup: /api/health returned HTTP ${res.status}`);
  }
  const health = (await res.json()) as { storage?: string; persistent?: boolean };
  if (health.persistent !== false) {
    throw new Error(
      `e2e global-setup: refusing to run against a server with persistent storage ` +
      `(storage=${health.storage}, persistent=${health.persistent}). ` +
      `E2E must target an isolated server started with MC_FORGELAB_DB=:memory:.`
    );
  }
}
