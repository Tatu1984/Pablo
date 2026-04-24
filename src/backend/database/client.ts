import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
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
