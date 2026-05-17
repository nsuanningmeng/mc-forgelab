import { describe, it, expect, beforeEach } from "vitest";
import { openStorage, BASE_MIGRATIONS } from "@mc-forgelab/storage";
import { createProviderManager } from "./manager.js";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./crypto.js";
import { STAGE2_MIGRATIONS } from "./migrations.js";

describe("crypto", () => {
  it("encrypts and decrypts", () => {
    const enc = encryptApiKey("sk-test-key", "secret");
    expect(decryptApiKey(enc, "secret")).toBe("sk-test-key");
  });
  it("masks api key", () => {
    expect(maskApiKey("sk-abcdefgh1234")).toBe("sk-a...1234");
    expect(maskApiKey("short")).toBe("****");
  });
});

describe("ProviderManager", () => {
  let manager: ReturnType<typeof createProviderManager>;

  beforeEach(async () => {
    const storage = await openStorage({ backend: "memory", migrations: [...BASE_MIGRATIONS, ...STAGE2_MIGRATIONS] });
    manager = createProviderManager(storage);
  });

  it("creates and retrieves a provider", () => {
    const p = manager.createProvider({
      displayName: "Test Provider",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      defaultModel: "gpt-4"
    });
    expect(p.displayName).toBe("Test Provider");
    expect(p.baseUrl).toBe("https://api.example.com/v1");
    expect(p.apiKeyEncrypted).not.toContain("sk-test");
    const retrieved = manager.getProvider(p.id);
    expect(retrieved.id).toBe(p.id);
  });

  it("lists providers", () => {
    manager.createProvider({ displayName: "A", baseUrl: "https://a.com/v1", apiKey: "k1", defaultModel: "m1" });
    manager.createProvider({ displayName: "B", baseUrl: "https://b.com/v1", apiKey: "k2", defaultModel: "m2" });
    expect(manager.listProviders()).toHaveLength(2);
  });

  it("creates default profiles", () => {
    const p = manager.createProvider({ displayName: "P", baseUrl: "https://x.com/v1", apiKey: "k", defaultModel: "m" });
    manager.ensureDefaultProfiles(p.id, "gpt-4");
    const profiles = manager.listProfiles();
    expect(profiles.length).toBe(8);
    const roles = profiles.map((pr) => pr.role);
    expect(roles).toContain("coder");
    expect(roles).toContain("fixer");
  });

  it("api key is not exposed in provider record", () => {
    const p = manager.createProvider({ displayName: "P", baseUrl: "https://x.com/v1", apiKey: "sk-secret-key", defaultModel: "m" });
    expect(JSON.stringify(p)).not.toContain("sk-secret-key");
  });

  it("deletes provider", () => {
    const p = manager.createProvider({ displayName: "P", baseUrl: "https://x.com/v1", apiKey: "k", defaultModel: "m" });
    manager.deleteProvider(p.id);
    expect(manager.listProviders()).toHaveLength(0);
  });
});
