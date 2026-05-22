import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 64 * 1024 * 1024;

function encode(buf: Buffer): string {
  return buf.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

async function derive(password: string, salt: Buffer, N: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, { N, r, p, maxmem: MAXMEM }, (err, derived) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Buffer.isBuffer(derived) ? derived : Buffer.from(derived));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH);
  return ["scrypt", "v1", SCRYPT_N, SCRYPT_R, SCRYPT_P, encode(salt), encode(hash)].join("$");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 7) return false;
  const [scheme, version, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (scheme !== "scrypt" || version !== "v1") return false;

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N <= 1 || r <= 0 || p <= 0) return false;

  try {
    const salt = decode(saltRaw ?? "");
    const expected = decode(hashRaw ?? "");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = await derive(password, salt, N, r, p, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
