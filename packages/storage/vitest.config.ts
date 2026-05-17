import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/storage",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
