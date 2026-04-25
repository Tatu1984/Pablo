import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withV1Auth } from "../../../_helpers";
import { getAgent } from "@/backend/repositories/agent.repository";
import { getRunsForAgent } from "@/backend/repositories/run.repository";
import { createRun } from "@/backend/services/run.service";
import { GatewayError } from "@/backend/gateway";
import { QuotaError } from "@/backend/services/quota.service";
import { RunnerError } from "@/backend/services/runner.service";
import { rateLimit, tooManyRequests } from "@/backend/utils/rate-limit.util";

// /v1/agents/{id}/runs
//   POST  → 202 {run_id, status:"queued"} per dev guide §7.4. The body
//           accepts {input: {message: "..."}} (canonical shape) or just
//           {message: "..."} as a convenience.
//   GET   → list recent runs for this agent.

const inputSchema = z.union([
  z.object({ input: z.object({ message: z.string().min(1).max(32_000) }) }),
  z.object({ message: z.string().min(1).max(32_000) }),
]);

function userMessage(body: unknown): string | null {
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return null;
  return "input" in parsed.data ? parsed.data.input.message : parsed.data.message;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;

  // Per-key rate limit: 60 runs / minute / key (or per-org for cookie-auth).
  const rlKey = auth.ctx.api_key_id ?? auth.ctx.org_id;
  const rl = await rateLimit({ key: `v1:runs:${rlKey}`, max: 60, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  const agent = await getAgent(auth.ctx.org_id, params.id);
  if (!agent) {
    return NextResponse.json(
      { type: "https://docs.pablo.ai/errors/not_found", title: "Not found", status: 404, code: "not_found" },
      { status: 404, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "invalid_body", "Request body must be JSON.");
  }
  const message = userMessage(body);
  if (!message) {
    return problem(400, "validation_error", "Body must include {input:{message}} or {message}.");
  }

  // Fire-and-forget: createRun runs to completion in this request. For real
  // async + cancel-from-API, set REDIS_URL — the chat endpoint is queue-aware
  // and the worker will handle the rest. The /v1 surface here is one-shot:
  // it waits for the run to finish, then returns the final shape.
  try {
    const result = await createRun({
      orgId: auth.ctx.org_id,
      agentId: agent.id,
      userMessage: message,
    });
    return NextResponse.json(
      {
        run_id: result?.runId ?? null,
        status: "completed",
        agent_id: agent.id,
        output: result ? { message: result.content } : null,
        usage: result?.usage,
      },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof QuotaError) {
      return problem(429, err.code, err.message, { quota: err.quota });
    }
    if (err instanceof GatewayError || err instanceof RunnerError) {
      return problem(502, err.code, err.message);
    }
    console.error("v1 run failed:", err);
    return problem(500, "internal", "Internal error");
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withV1Auth(req);
  if ("error" in auth) return auth.error;
  const agent = await getAgent(auth.ctx.org_id, params.id);
  if (!agent) {
    return problem(404, "not_found", "Agent not found.");
  }
  const runs = await getRunsForAgent(auth.ctx.org_id, agent.id);
  return NextResponse.json({ data: runs });
}

function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: `https://docs.pablo.ai/errors/${code}`,
      title: status === 429 ? "Quota exceeded" : status === 502 ? "Upstream error" : "Bad request",
      status,
      code,
      detail,
      ...extra,
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}
