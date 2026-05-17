import type { FastifyInstance } from "fastify";
import type { AppContext } from "./types.js";
import { doctor } from "@mc-forgelab/toolchain-manager";

export async function registerToolchainRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.get("/api/toolchains/doctor", async () => {
    const results = await doctor();
    return { results };
  });
}
