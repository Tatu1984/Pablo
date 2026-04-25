import { type NextRequest } from "next/server";
import { z } from "zod";
import { createRun, RunError } from "@/backend/services/run.service";
import { RunnerError } from "@/backend/services/runner.service";
import { requireSession } from "@/backend/services/session.service";
import { GatewayError } from "@/backend/gateway";
import { QuotaError } from "@/backend/services/quota.service";
import { newId } from "@/backend/utils/id.util";
import { rateLimit, tooManyRequests } from "@/backend/utils/rate-limit.util";
import { getAgent } from "@/backend/repositories/agent.repository";
import {
  eventChannel,
  getRedisSubscriber,
  isQueueEnabled,
} from "@/backend/queue/connection";
import { getRunsQueue } from "@/backend/queue/runs.queue";

const bodySchema = z.object({ message: z.string().trim().min(1).max(32_000) });

const TERMINAL_EVENTS = new Set(["completed", "failed"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // Cap chat throughput per user — protects the LLM key from a runaway tab.
  const rl = await rateLimit({
    key: `chat:${session.user.id}`,
    max: 30,
    windowSec: 60,
  });
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ errors: parsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pre-validate that the agent exists for this org so we can reject early
  // (and so the queue path doesn't have to be the one returning 404s).
  const agent = await getAgent(session.org.id, params.id);
  if (!agent) return new Response("Agent not found", { status: 404 });

  const stream = isQueueEnabled()
    ? buildQueuedStream(session.org.id, agent.id, parsed.data.message)
    : buildInlineStream(session.org.id, agent.id, parsed.data.message);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── Inline path (no Redis) ──────────────────────────────────────────────────

function buildInlineStream(
  orgId: string,
  agentId: string,
  userMessage: string,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        await createRun({
          orgId,
          agentId,
          userMessage,
          onDelta: (chunk) => push("delta", { content: chunk }),
          onEvent: (ev) => {
            switch (ev.type) {
              case "started":
                push("started", ev.payload);
                break;
              case "tool_call":
                push("tool_call", ev.payload);
                break;
              case "tool_result":
                push("tool_result", ev.payload);
                break;
              case "completed":
                push("completed", ev.payload);
                break;
              case "failed":
                push("failed", ev.payload);
                break;
              case "delta":
                break;
            }
          },
        });
      } catch (err) {
        if (err instanceof QuotaError) {
          push("failed", {
            code: err.code,
            detail: err.message,
            quota: err.quota,
          });
        } else if (
          err instanceof GatewayError ||
          err instanceof RunError ||
          err instanceof RunnerError
        ) {
          push("failed", { code: err.code, detail: err.message });
        } else {
          push("failed", {
            code: "internal",
            detail: err instanceof Error ? err.message : "Unknown error",
          });
          console.error("chat stream failed (inline):", err);
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Queued path ─────────────────────────────────────────────────────────────
//
// 1. Pre-allocate run_id so the channel name is known before we enqueue.
// 2. Subscribe to the run's pub/sub channel.
// 3. Enqueue the BullMQ job — the worker process will execute it.
// 4. Pipe every published event onto the SSE stream.
// 5. Close on terminal event (completed / failed) or client disconnect.
//
// This is what makes runs durable: closing the tab does not kill the run.

function buildQueuedStream(
  orgId: string,
  agentId: string,
  userMessage: string,
): ReadableStream<Uint8Array> {
  const runId = newId("run");

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const sub = getRedisSubscriber().duplicate();
      const channel = eventChannel(runId);
      let closed = false;

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        try {
          await sub.unsubscribe(channel);
        } catch {
          /* ignore */
        }
        sub.disconnect();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      sub.on("message", (ch, payload) => {
        if (ch !== channel) return;
        try {
          const { event, data } = JSON.parse(payload) as { event: string; data: unknown };
          push(event, data);
          if (TERMINAL_EVENTS.has(event)) void cleanup();
        } catch (err) {
          console.error("bad pub/sub frame:", err);
        }
      });

      try {
        await sub.subscribe(channel);
        // Inform the client the run id immediately so it could cancel.
        push("queued", { run_id: runId });
        await getRunsQueue().add(
          "run",
          { runId, orgId, agentId, userMessage },
          { jobId: runId },
        );
      } catch (err) {
        push("failed", {
          code: "queue_unavailable",
          detail: err instanceof Error ? err.message : "Queue not reachable",
        });
        await cleanup();
      }
    },

    async cancel() {
      // Browser closed — let the worker keep running but drop our subscription.
      // (Worker will emit terminal events; nobody will be listening.)
    },
  });
}
