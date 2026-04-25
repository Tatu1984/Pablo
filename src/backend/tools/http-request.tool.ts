import { ToolError } from "./types";
import type { Tool } from "./types";

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_000_000;

const PRIVATE_RANGES: [bigint, bigint][] = [
  [ipv4ToBig("10.0.0.0"), ipv4ToBig("10.255.255.255")],
  [ipv4ToBig("172.16.0.0"), ipv4ToBig("172.31.255.255")],
  [ipv4ToBig("192.168.0.0"), ipv4ToBig("192.168.255.255")],
  [ipv4ToBig("127.0.0.0"), ipv4ToBig("127.255.255.255")],
  [ipv4ToBig("169.254.0.0"), ipv4ToBig("169.254.255.255")],
  [ipv4ToBig("0.0.0.0"), ipv4ToBig("0.255.255.255")],
];

export const httpRequestTool: Tool = {
  name: "http.request",
  description:
    "Make an outbound HTTPS request. URL must be public; private/loopback ranges are blocked. Response body is capped.",
  input_schema: {
    type: "object",
    required: ["url"],
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET" },
      url: { type: "string", format: "uri" },
      headers: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      body: {
        description: "Request body. JSON-encoded if an object.",
        oneOf: [{ type: "string" }, { type: "object" }, { type: "null" }],
      },
    },
  },
  output_schema: {
    type: "object",
    properties: {
      status: { type: "integer" },
      headers: { type: "object" },
      body: {},
      truncated: { type: "boolean" },
    },
  },

  async execute(rawInput) {
    const input = rawInput as {
      method?: string;
      url: string;
      headers?: Record<string, string>;
      body?: unknown;
    };
    if (!input || typeof input.url !== "string") {
      throw new ToolError("invalid_input", "`url` is required.");
    }

    const url = parseAndValidateUrl(input.url);

    const method = (input.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = { ...(input.headers ?? {}) };
    let body: BodyInit | undefined;
    if (input.body !== undefined && input.body !== null) {
      if (typeof input.body === "string") body = input.body;
      else {
        body = JSON.stringify(input.body);
        if (!headers["content-type"] && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, headers, body, signal: ctrl.signal });

      const reader = res.body?.getReader();
      let received = 0;
      const chunks: Uint8Array[] = [];
      let truncated = false;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > MAX_BODY_BYTES) {
            truncated = true;
            ctrl.abort();
            break;
          }
          chunks.push(value);
        }
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const text = buf.toString("utf8");

      let parsed: unknown = text;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          parsed = JSON.parse(text);
        } catch {
          /* leave as text */
        }
      }

      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });

      return {
        status: res.status,
        headers: respHeaders,
        body: parsed,
        truncated,
      };
    } catch (err) {
      if (err instanceof ToolError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted")) throw new ToolError("timeout", `Request timed out after ${TIMEOUT_MS}ms`);
      throw new ToolError("upstream", `Request failed: ${msg}`);
    } finally {
      clearTimeout(t);
    }
  },
};

function parseAndValidateUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ToolError("invalid_input", `Invalid URL: ${raw}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new ToolError("invalid_input", `Only http(s) URLs allowed, got ${u.protocol}`);
  }

  // Allow plain hostnames (resolved at fetch time) but block obvious loopback
  // and private-IP literals. DNS rebinding is mitigated by the runtime fetch
  // egress allow-list in production; for now we just block the obvious cases.
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new ToolError("egress_blocked", "Loopback hostnames are not permitted.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const big = ipv4ToBig(host);
    for (const [from, to] of PRIVATE_RANGES) {
      if (big >= from && big <= to) {
        throw new ToolError("egress_blocked", `Private IP ${host} is not permitted.`);
      }
    }
  }
  return u;
}

function ipv4ToBig(addr: string): bigint {
  const parts = addr.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return 0n;
  }
  return (
    (BigInt(parts[0]) << 24n) +
    (BigInt(parts[1]) << 16n) +
    (BigInt(parts[2]) << 8n) +
    BigInt(parts[3])
  );
}
