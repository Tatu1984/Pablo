import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM envelope for BYO provider API keys. We store a single string
// that packs iv, auth tag, and ciphertext so key rotation can remain simple.
// Storage shape:  v1.<iv-base64>.<tag-base64>.<ciphertext-base64>

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function key(): Buffer {
  const raw = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!raw) throw new Error("PROVIDER_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `PROVIDER_ENCRYPTION_KEY must decode to 32 bytes; got ${buf.length}. Generate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("Cannot encrypt an empty secret");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(packed: string): string {
  const [version, ivB64, tagB64, dataB64] = packed.split(".");
  if (version !== VERSION) throw new Error(`Unknown secret version: ${version}`);

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

// Shown in the UI so users can identify a key without decrypting.
export function keyPrefix(plain: string): string {
  if (!plain) return "";
  return plain.slice(0, 8);
}
