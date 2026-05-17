import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const SALT = "mc-forgelab-key-v1";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/** Chiffre une clé API. Retourne une chaîne hex encodée. */
export function encryptApiKey(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Déchiffre une clé API. Lève une erreur si le format est invalide. */
export function decryptApiKey(ciphertext: string, secret: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted key format");
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") + decipher.final("utf8");
}

/** Masque une clé API pour les logs: sk-ab...xy12 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
