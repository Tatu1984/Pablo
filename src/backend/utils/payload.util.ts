// Trace event payloads land in `run_events.payload` (JSONB). To keep the
// table size bounded we cap each payload's serialised size and replace
// oversized fields with a marker. S3 offload is the next step (per
// developer guide §5.2 / §8.3) once we feel the pinch.

const MAX_BYTES = 64_000;
const MAX_STRING_BYTES = 16_000;

export function truncatePayload<T>(payload: T): T {
  return shrink(payload, MAX_STRING_BYTES) as T;
}

function size(v: unknown): number {
  return Buffer.byteLength(JSON.stringify(v) ?? "", "utf8");
}

function shrink(v: unknown, stringCap: number): unknown {
  if (v == null) return v;
  if (typeof v === "string") {
    return v.length > stringCap
      ? `${v.slice(0, stringCap)}…[truncated ${v.length - stringCap} chars]`
      : v;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (const item of v) {
      out.push(shrink(item, stringCap));
      if (size(out) > MAX_BYTES) {
        out.push({ __truncated: true, dropped: v.length - out.length });
        break;
      }
    }
    return out;
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = shrink(val, stringCap);
      if (size(out) > MAX_BYTES) {
        out.__truncated = true;
        break;
      }
    }
    return out;
  }
  return v;
}
