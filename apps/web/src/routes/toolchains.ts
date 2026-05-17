import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { doctor } from "@mc-forgelab/toolchain-manager";

// doctor() currently returns one entry per supported Java version.
// We project it into a shape friendly to the new Toolchains UI:
//   { results: [...] }   // legacy field, preserved for callers
//   { java: [...] }      // detected Java toolchains
//   { tools: [...] }     // detected build tools (Gradle / Maven) — placeholder
export async function registerToolchainRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get("/api/toolchains/doctor", async () => {
    const results = await doctor();
    const java = results
      .filter((r) => r.toolName === "java" && r.installed)
      .map((r) => ({
        version: r.version ?? "",
        path: "",
        issues: r.issues ?? [],
      }));
    const tools: Array<{ name: string; version: string }> = [];
    return { results, java, tools };
  });
}
