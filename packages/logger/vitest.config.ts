import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/logger",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
