import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// Argon2id — per dev guide §10.1. Tuned for ~50ms on modern hardware, which
// is the OWASP-recommended minimum cost for interactive auth.
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, OPTIONS);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argonVerify(hash, plain);
}
