import IORedis from "ioredis";

declare global {
  var __redis: IORedis | undefined;
  var __redisSub: IORedis | undefined;
}

// Worker / Queue / pub-sub callers all need their own ioredis client (BullMQ
// requires a dedicated subscriber). We keep two singletons in dev so HMR
// doesn't leak connections.

function makeClient(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2_000,
  });
  // Without an `error` listener ioredis prints "[ioredis] Unhandled error
  // event" and the noise floods the log. Callers (rate-limit, chat SSE,
  // queue) handle their own failure modes.
  client.on("error", () => {});
  return client;
}

export function isQueueEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedis(): IORedis {
  if (!global.__redis) global.__redis = makeClient();
  return global.__redis;
}

export function getRedisSubscriber(): IORedis {
  if (!global.__redisSub) global.__redisSub = makeClient();
  return global.__redisSub;
}

export function eventChannel(runId: string): string {
  return `pablo:run:${runId}`;
}
