import type { FastifyInstance } from "fastify";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";
import type { Target, TargetVersionConstraint } from "@mc-forgelab/target-registry";

interface McVersionOption {
  readonly version: string;
  readonly recommendedJava: number;
  readonly recommendedGradle?: string;
  readonly buildTool: string;
}

// Known Minecraft versions surfaced as project creation options. Order
// is preserved (oldest first) so the dropdown grouping by major works.
const KNOWN_MC_VERSIONS = [
  "1.16.5",
  "1.17.1",
  "1.18.2",
  "1.19.4",
  "1.20.1",
  "1.20.2",
  "1.20.4",
  "1.20.6",
  "1.21",
  "1.21.1",
  "1.21.3",
  "1.21.4"
];

// Java version expected by Mojang for each Minecraft major. Used to
// override per-target `recommendedJava` so the hint under the version
// picker is accurate even when the target's versionConstraint covers
// multiple MC majors.
function javaForMcVersion(version: string): number {
  const [maj, min] = version.split(".").map((n) => Number.parseInt(n, 10));
  if (maj !== 1) return 21;
  if (min === undefined) return 21;
  if (min <= 16) return 8;
  if (min === 17) return 16;
  if (min >= 18 && min <= 20) return 17;
  return 21;
}

function serializeTarget(target: Target) {
  return {
    id: target.id,
    displayName: target.displayName,
    type: target.type,
    stability: target.stability,
    recommendedBuildTool: target.recommendedBuildTool,
    deprecated: target.deprecated,
    experimental: target.experimental,
    legacy: target.legacy,
    versionConstraints: target.versionConstraints.map((c) => ({
      minecraftRange: c.minecraftRange,
      recommendedJava: c.recommendedJava,
      supportedJava: c.supportedJava,
      recommendedGradle: c.recommendedGradle,
      supportedGradle: c.supportedGradle
    })),
    templateIds: target.templateIds,
    docsUrl: target.docsUrl,
    warningsZh: target.warningsZh,
    warningsEn: target.warningsEn,
    capabilities: target.capabilities
  };
}

function compareMcVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10));
  const pb = b.split(".").map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Per-target lower-bound floor for MC support, used to filter out
// versions that simply don't exist for that ecosystem (Folia / NeoForge
// only appeared mid-1.20; Quilt only from 1.18).
function minMajorFor(targetId: string): number {
  switch (targetId) {
    case "folia": return 20;       // Folia is 1.20+
    case "neoforge": return 20;    // NeoForge forked from Forge at 1.20
    case "quilt": return 18;       // Quilt Loader stable from 1.18
    default: return 16;             // everything else covers 1.16 onward
  }
}

function targetSupportsVersion(target: Target, version: string): boolean {
  const [maj, min] = version.split(".").map((n) => Number.parseInt(n, 10));
  if (maj !== 1) return false;
  const floor = minMajorFor(target.id);
  return min !== undefined && min >= floor;
}

function gradleHintFor(_constraint: TargetVersionConstraint | undefined, mcMajor: number): string | undefined {
  // Newer MC versions need newer Gradle. Coarse mapping that is good
  // enough for the picker hint; CLI/buildtool layer enforces specifics.
  if (mcMajor >= 21) return "8.10";
  if (mcMajor >= 20) return "8.7";
  if (mcMajor >= 18) return "7.6";
  return "7.5";
}

export async function registerTargetRoutes(app: FastifyInstance) {
  const registry = createDefaultRegistry();

  app.get("/api/targets", async () => {
    return registry.list({ includeLegacy: true, includeDeprecated: true }).map(serializeTarget);
  });

  app.get<{ Params: { id: string } }>("/api/targets/:id", async (req, reply) => {
    const target = registry.find(req.params.id);
    if (!target) return reply.status(404).send({ error: "Target not found" });
    return serializeTarget(target);
  });

  app.get<{ Params: { id: string } }>("/api/targets/:id/mc-versions", async (req, reply) => {
    const target = registry.find(req.params.id);
    if (!target) return reply.status(404).send({ error: "Target not found" });

    const versions: McVersionOption[] = [];
    for (const version of KNOWN_MC_VERSIONS) {
      if (!targetSupportsVersion(target, version)) continue;
      const [, mcMin] = version.split(".").map((n) => Number.parseInt(n, 10));
      const constraint = target.versionConstraints[0];
      versions.push({
        version,
        recommendedJava: javaForMcVersion(version),
        recommendedGradle: gradleHintFor(constraint, mcMin ?? 0),
        buildTool: target.recommendedBuildTool
      });
    }

    return versions.sort((a, b) => compareMcVersion(a.version, b.version));
  });
}
