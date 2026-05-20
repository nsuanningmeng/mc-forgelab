import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    // Keep Playwright e2e specs out of the vitest run — they use
    // @playwright/test which throws "test.describe was not expected here"
    // when imported by vitest. Run them via `pnpm test:e2e` instead.
    // Component tests (*.test.tsx) need jsdom — run via vitest.component.config.ts
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "**/*.test.tsx"],
  },
});
