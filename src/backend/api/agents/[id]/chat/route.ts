import { type NextRequest } from "next/server";
import { z } from "zod";
import { createRun, RunError } from "@/backend/services/run.service";
import { RunnerError } from "@/backend/services/runner.service";
import { requireSession } from "@/backend/services/session.service";
import { GatewayError } from "@/backend/gateway";

const bodySchema = z.object({ message: z.string().trim().min(1).max(32_000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        await createRun({
          orgId: session.org.id,
          agentId: params.id,
          userMessage: parsed.data.message,
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
              // delta is handled via onDelta above
              case "delta":
                break;
            }
          },
        });
      } catch (err) {
        if (
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
          console.error("chat stream failed:", err);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
