import { Queue } from "bullmq";
import { eventChannel, getRedis, isQueueEnabled } from "./connection";

export const RUNS_QUEUE_NAME = "pablo:runs";

export interface RunJob {
  runId: string;
  orgId: string;
  agentId: string;
  userMessage: string;
}

declare global {
  var __runsQueue: Queue<RunJob> | undefined;
}

export function getRunsQueue(): Queue<RunJob> {
  if (!isQueueEnabled()) {
    throw new Error("Queue is not enabled (REDIS_URL not set).");
  }
  if (!global.__runsQueue) {
    global.__runsQueue = new Queue<RunJob>(RUNS_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 60 * 60, count: 1000 },
        removeOnFail: { age: 24 * 60 * 60, count: 1000 },
      },
    });
  }
  return global.__runsQueue;
}

// Workers publish events into the per-run pub/sub channel; the API handler
// subscribes for that run only and pipes them to the SSE stream.
export async function publishRunEvent(
  runId: string,
  event: string,
  data: unknown,
): Promise<void> {
  await getRedis().publish(eventChannel(runId), JSON.stringify({ event, data }));
}
