import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/core",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
