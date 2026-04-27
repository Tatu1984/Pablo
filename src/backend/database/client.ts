import { Pool, type PoolClient } from "@neondatabase/serverless";

declare global {
  var __pgPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Neon's serverless driver speaks WebSockets, which is what Vercel
  // serverless functions actually allow (raw TCP to a DB host can hang for
  // the full 300s function timeout). API-compatible with `pg.Pool`.
  return new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
}

// Reuse the pool across Next.js dev-mode HMR reloads.
export const pool: Pool = global.__pgPool ?? (global.__pgPool = makePool());

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

// Run `fn` on a single pooled client inside BEGIN/COMMIT.
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
