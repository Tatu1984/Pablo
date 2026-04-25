// Idempotent DB initialiser:
//   1. applies sql/schema.sql
//   2. seeds org/user/providers/agents/runs/run_events
//
// Run with:
//   node --env-file=.env.local scripts/init-db.mjs
//
// Uses `pg` (node-postgres) over a direct TCP+TLS connection to Neon so the
// whole schema can run as a single multi-statement call. Seed inserts use
// ON CONFLICT DO NOTHING so re-running is safe.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { hash as argonHash } from "@node-rs/argon2";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "sql/schema.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Did you pass --env-file=.env.local?");
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("→ applying schema");
    const schema = await readFile(schemaPath, "utf8");
    await client.query(schema);
    console.log("  schema.sql applied");

    console.log("→ seeding");
    SEED.user.password_hash = await argonHash("demo", {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await seed(client);
    console.log("✓ done");
  } finally {
    await client.end();
  }
}

async function seed(client) {
  const d = SEED;

  // Skeleton org + demo user so /login still works as a known account.
  await client.query(
    `INSERT INTO orgs (id, name, plan, created_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [d.org.id, d.org.name, d.org.plan, d.org.created_at],
  );

  await client.query(
    `INSERT INTO users (id, email, password_hash, created_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [d.user.id, d.user.email, d.user.password_hash, d.user.created_at],
  );

  await client.query(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES ($1,$2,'owner')
     ON CONFLICT DO NOTHING`,
    [d.org.id, d.user.id],
  );

  // The demo org used to come pre-loaded with three sample agents and four
  // providers; that's gone now. Re-running this script also wipes anything
  // left over in the demo org so a fresh `npm run db:init` always lands you
  // on an empty workspace.
  await client.query(`DELETE FROM run_events    WHERE run_id IN (SELECT id FROM runs WHERE org_id = $1)`, [d.org.id]);
  await client.query(`DELETE FROM runs           WHERE org_id = $1`, [d.org.id]);
  await client.query(`DELETE FROM agent_memory   WHERE agent_id IN (SELECT id FROM agents WHERE org_id = $1)`, [d.org.id]);
  await client.query(`DELETE FROM prompt_versions WHERE agent_id IN (SELECT id FROM agents WHERE org_id = $1)`, [d.org.id]);
  await client.query(`DELETE FROM agents          WHERE org_id = $1`, [d.org.id]);
  await client.query(`DELETE FROM providers       WHERE org_id = $1`, [d.org.id]);

  console.log(`  seeded org + demo user; demo org workspace cleared`);
}

const SEED = {
  org: { id: "org_demo", name: "Demo Org", plan: "starter", created_at: "2026-01-01T00:00:00Z" },
  user: {
    id: "user_demo",
    email: "demo@pablo.ai",
    // Replaced with an argon2id hash of "demo" inside run() before seeding.
    password_hash: "$argon2id$placeholder",
    created_at: "2026-01-01T00:00:00Z",
  },
};

// ─── entry ───────────────────────────────────────────────────────────────────
const isEntry = pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntry) {
  try {
    await run();
  } catch (e) {
    console.error("✗ init-db failed:", e);
    process.exit(1);
  }
}
