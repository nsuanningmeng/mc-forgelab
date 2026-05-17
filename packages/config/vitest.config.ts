import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/config",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
