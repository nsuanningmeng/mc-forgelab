import type { FastifyInstance } from "fastify";
import { createDefaultRegistry } from "@mc-forgelab/target-registry";
import type { Target, TargetVersionConstraint } from "@mc-forgelab/target-registry";

interface McVersionOption {
  readonly version: string;
  readonly recommendedJava: number;
  readonly recommendedGradle?: string;
  readonly buildTool: string;
}

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

function matchesRange(version: string, range: string): boolean {
  const parts = range.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1 && !/^[<>]=?/.test(parts[0]!)) return compareMcVersion(version, parts[0]!) === 0;

  return parts.every((part) => {
    const match = part.match(/^(>=|<=|>|<|=)?(.+)$/);
    if (!match) return true;
    const op = match[1] ?? "=";
    const bound = match[2]!;
    const cmp = compareMcVersion(version, bound);
    if (op === ">=") return cmp >= 0;
    if (op === "<=") return cmp <= 0;
    if (op === ">") return cmp > 0;
    if (op === "<") return cmp < 0;
    return cmp === 0;
  });
}

function expandConstraint(target: Target, constraint: TargetVersionConstraint): McVersionOption[] {
  const candidates = target.stability === "stable"
    ? KNOWN_MC_VERSIONS.filter((v) => v.startsWith("1.20.") || v.startsWith("1.21"))
    : KNOWN_MC_VERSIONS;

  return candidates
    .filter((version) => matchesRange(version, constraint.minecraftRange))
    .map((version) => ({
      version,
      recommendedJava: constraint.recommendedJava,
      recommendedGradle: constraint.recommendedGradle,
      buildTool: target.recommendedBuildTool
    }));
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

    const seen = new Set<string>();
    const versions: McVersionOption[] = [];
    for (const constraint of target.versionConstraints) {
      for (const item of expandConstraint(target, constraint)) {
        if (seen.has(item.version)) continue;
        seen.add(item.version);
        versions.push(item);
      }
    }

    return versions.sort((a, b) => compareMcVersion(a.version, b.version));
  });
}
