import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E isolation strategy:
 * Use a temporary directory as MCFL_WORKSPACE to avoid polluting local dev data.
 */
const testWorkspace = path.join(os.tmpdir(), `mcfl-e2e-${Date.now()}`);

export default defineConfig({
  testDir: './e2e',
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
    baseURL: 'http://127.0.0.1:3000',
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
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      MC_FORGELAB_MODE: 'web',
      MC_FORGELAB_PORT: '3000',
      MC_FORGELAB_WORKSPACE: testWorkspace,
      MC_FORGELAB_DB: ':memory:',
      MC_FORGELAB_LOG_LEVEL: 'debug',
    },
  },
});
