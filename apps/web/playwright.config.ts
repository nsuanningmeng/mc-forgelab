import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E isolation strategy:
 * - Dedicated port (3344) so we can never attach to the installed desktop
 *   app or a local `pnpm dev`, both of which default to port 3000 and a
 *   PERSISTENT per-user database. Reusing those wrote e2e garbage projects
 *   and providers into real user data.
 * - reuseExistingServer is always false: every run gets a fresh server with
 *   an in-memory DB and throwaway temp dirs.
 * - global-setup.ts additionally asserts /api/health reports a non-persistent
 *   backend before any test runs.
 */
const E2E_PORT = 3344;
const testWorkspace = path.join(os.tmpdir(), `mcfl-e2e-${Date.now()}`);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    process.env.CI ? ['github'] : ['list']
  ],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    cwd: __dirname,
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      MC_FORGELAB_MODE: 'web',
      MC_FORGELAB_PORT: String(E2E_PORT),
      MC_FORGELAB_WORKSPACE: testWorkspace,
      MC_FORGELAB_DB: ':memory:',
      MC_FORGELAB_TOOLCHAINS: path.join(testWorkspace, 'toolchains'),
      MC_FORGELAB_LOGS: path.join(testWorkspace, 'logs'),
      MC_FORGELAB_ALLOW_LOCAL_PROVIDERS: 'true',
      MC_FORGELAB_LOG_LEVEL: 'debug',
    },
  },
});
