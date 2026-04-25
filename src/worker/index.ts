// Pablo background worker.
//
// Runs in its own Node process — start with `npm run worker`. Pulls jobs
// from the BullMQ "pablo:runs" queue and executes them via the existing
// run service. Every event the runner emits is published to a Redis
// pub/sub channel keyed by run_id; the API server subscribes to that
// channel and pipes events onto the SSE stream.
//
// This is what makes runs survive tab closes: the worker keeps going.

import { Worker } from "bullmq";
import { getRedis } from "@/backend/queue/connection";
import { publishRunEvent, RUNS_QUEUE_NAME, type RunJob } from "@/backend/queue/runs.queue";
import { createRun } from "@/backend/services/run.service";

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL is not set — worker cannot start");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set — worker cannot start");
  process.exit(1);
}

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);
const workerId = process.env.WORKER_ID ?? `wkr-${process.pid}`;

const worker = new Worker<RunJob>(
  RUNS_QUEUE_NAME,
  async (job) => {
    const { runId, orgId, agentId, userMessage } = job.data;
    console.log(`[${workerId}] picked up ${runId} (agent ${agentId})`);

    try {
      await createRun({
        orgId,
        agentId,
        userMessage,
        onDelta: (chunk) => {
          void publishRunEvent(runId, "delta", { content: chunk });
        },
        onEvent: (ev) => {
          if (ev.type === "delta") return; // already handled via onDelta
          void publishRunEvent(runId, ev.type, ev.payload);
        },
      });
      console.log(`[${workerId}] completed ${runId}`);
    } catch (err) {
      // The runner already publishes a "failed" event before throwing, so
      // we just log here. A second "failed" frame would be redundant.
      console.error(`[${workerId}] ${runId} threw:`, err);
      throw err;
    }
  },
  {
    connection: getRedis(),
    concurrency,
  },
);

worker.on("ready", () => {
  console.log(`[${workerId}] worker ready (concurrency=${concurrency})`);
});
worker.on("failed", (job, err) => {
  console.error(`[${workerId}] job ${job?.id} failed:`, err.message);
});

const shutdown = async (signal: string) => {
  console.log(`[${workerId}] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
