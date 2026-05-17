import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/cli",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
