import { describe, expect, it } from "vitest";
import { truncatePayload } from "@/backend/utils/payload.util";

describe("truncatePayload", () => {
  it("returns small values unchanged", () => {
    const v = { a: 1, b: "hello", c: [1, 2, 3] };
    expect(truncatePayload(v)).toEqual(v);
  });

  it("caps strings that exceed the per-string limit", () => {
    const big = "x".repeat(50_000);
    const out = truncatePayload({ blob: big }) as { blob: string };
    expect(out.blob.length).toBeLessThan(big.length);
    expect(out.blob).toContain("[truncated");
  });

  it("marks oversized arrays with __truncated", () => {
    const arr = Array.from({ length: 1000 }, () => "x".repeat(2_000));
    const out = truncatePayload(arr) as unknown[];
    const last = out[out.length - 1] as { __truncated?: boolean };
    expect(last.__truncated).toBe(true);
  });
});
