import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

// Generate a deterministic test key once and stick it on env so the helper
// loads cleanly. Other tests in this file share it.
process.env.PROVIDER_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

import { decryptSecret, encryptSecret, keyPrefix } from "@/backend/utils/crypto.util";

describe("crypto.util", () => {
  it("round-trips a secret", () => {
    const plain = "sk-or-v1-shhh-this-is-secret";
    const packed = encryptSecret(plain);
    expect(packed).toMatch(/^v1\.[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+$/);
    expect(decryptSecret(packed)).toBe(plain);
  });

  it("produces different ciphertexts for the same plain (random IV)", () => {
    const plain = "fixed-input";
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain));
  });

  it("rejects tampered ciphertext", () => {
    const packed = encryptSecret("hello");
    const parts = packed.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("returns the correct prefix", () => {
    expect(keyPrefix("sk-live-12345abcdef")).toBe("sk-live-");
    expect(keyPrefix("")).toBe("");
  });
});
