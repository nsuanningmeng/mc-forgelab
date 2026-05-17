import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@mc-forgelab/compatibility",
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
