import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/target-registry",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
