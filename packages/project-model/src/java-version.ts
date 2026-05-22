export type SupportedJavaVersion = 8 | 11 | 17 | 21;

export interface JavaVersionDetection {
  version: SupportedJavaVersion | null;
  source: "toolchain" | "sourceCompatibility" | "none";
  rawValue?: string;
}

interface JavaVersionMatcher {
  readonly source: "toolchain" | "sourceCompatibility";
  readonly regex: RegExp;
}

const MATCHERS: readonly JavaVersionMatcher[] = [
  {
    source: "toolchain",
    regex: /JavaLanguageVersion\.of\(\s*["']?([0-9]+(?:\.[0-9]+)?)["']?\s*\)/,
  },
  {
    source: "sourceCompatibility",
    regex: /JavaVersion\.VERSION_(17)\b/,
  },
  {
    source: "sourceCompatibility",
    regex: /JavaVersion\.VERSION_(1_8)\b/,
  },
  {
    source: "sourceCompatibility",
    regex: /JavaVersion\.VERSION_(8|11|21)\b/,
  },
  {
    source: "sourceCompatibility",
    regex: /JavaVersion\.VERSION_(1_8|[0-9]+)\b/,
  },
  {
    source: "sourceCompatibility",
    regex: /sourceCompatibility\s*(?:=|\s)\s*["']?(17)(?:["']|\b)/,
  },
  {
    source: "sourceCompatibility",
    regex: /sourceCompatibility\s*(?:=|\s)\s*["']?(1\.8)(?:["']|\b)/,
  },
  {
    source: "sourceCompatibility",
    regex: /sourceCompatibility\s*(?:=|\s)\s*["']?([0-9]+(?:\.[0-9]+)?)(?:["']|\b)/,
  },
];

function stripGradleComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function normalizeJavaVersion(rawValue: string): SupportedJavaVersion | null {
  const normalized = rawValue.trim().replace(/_/g, ".");
  if (normalized === "1.8") return 8;
  if (normalized === "8") return 8;
  if (normalized === "11") return 11;
  if (normalized === "17") return 17;
  if (normalized === "21") return 21;
  return null;
}

export function detectGradleJavaVersion(content: string): JavaVersionDetection {
  const source = stripGradleComments(content);

  for (const matcher of MATCHERS) {
    const match = matcher.regex.exec(source);
    const rawValue = match?.[1];
    if (!rawValue) continue;

    const version = normalizeJavaVersion(rawValue);
    if (version === null) return { version: null, source: "none", rawValue };
    return { version, source: matcher.source, rawValue };
  }

  return { version: null, source: "none" };
}
