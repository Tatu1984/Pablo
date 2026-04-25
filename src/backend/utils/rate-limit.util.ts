// Sliding-window rate limiter. Redis-backed when REDIS_URL is set, falls
// back to an in-memory map for single-process dev.
//
// Usage:
//   const r = await rateLimit({key: `auth:login:${ip}`, max: 10, windowSec: 60});
//   if (!r.allowed) return tooManyRequests(r.retryAfter);

import { isQueueEnabled, getRedis } from "@/backend/queue/connection";

export interface RateLimitArgs {
  key: string;
  max: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface MemEntry {
  count: number;
  resetAt: number;
}

declare global {
  var __rateLimitMem: Map<string, MemEntry> | undefined;
}

function memStore(): Map<string, MemEntry> {
  if (!global.__rateLimitMem) global.__rateLimitMem = new Map();
  return global.__rateLimitMem;
}

export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = args.windowSec * 1_000;

  if (isQueueEnabled()) {
    const r = getRedis();
    const fullKey = `pablo:rl:${args.key}`;
    // INCR + set EXPIRE on first use. Pipeline keeps it atomic-enough.
    const pipeline = r.multi();
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, args.windowSec, "NX");
    pipeline.pttl(fullKey);
    const reply = await pipeline.exec();
    if (!reply) {
      return { allowed: true, remaining: args.max, retryAfterSec: 0 };
    }
    const count = Number(reply[0]?.[1] ?? 0);
    const ttlMs = Number(reply[2]?.[1] ?? windowMs);
    if (count > args.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, args.max - count),
      retryAfterSec: 0,
    };
  }

  const m = memStore();
  const entry = m.get(args.key);
  if (!entry || entry.resetAt <= now) {
    m.set(args.key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: args.max - 1, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > args.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, args.max - entry.count),
    retryAfterSec: 0,
  };
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "anon";
}

export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      type: "https://docs.pablo.ai/errors/rate_limited",
      title: "Too many requests",
      status: 429,
      code: "rate_limited",
      detail: `Slow down. Try again in ${retryAfterSec}s.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/problem+json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
