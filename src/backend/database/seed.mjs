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
import { createCipheriv, randomBytes } from "node:crypto";
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

  // Mirror auto-provision behaviour for the demo org: drop in an OpenRouter
  // provider populated from OPENROUTER_API_KEY (encrypted with the same
  // PROVIDER_ENCRYPTION_KEY the running app uses) so demo@pablo.ai can chat
  // immediately on first login.
  if (process.env.OPENROUTER_API_KEY) {
    const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
    const encryptedKey = encryptSecretLikeApp(process.env.OPENROUTER_API_KEY);
    const prefix = process.env.OPENROUTER_API_KEY.slice(0, 8);
    const providerId = cryptoIdLikeApp("prov");
    const models = [
      "openai/gpt-4o-mini",
      "anthropic/claude-haiku-4.5",
      "google/gemini-2.0-flash",
      "meta/llama-3.1-70b-instruct",
      "minimax/minimax-m2.5:free",
    ];
    await client.query(
      `INSERT INTO providers
         (id, org_id, name, type, base_url, key_prefix, encrypted_key, models, status, byo)
       VALUES ($1, $2, 'OpenRouter', 'openrouter', $3, $4, $5, $6::jsonb, 'active', true)`,
      [providerId, d.org.id, baseUrl, prefix, encryptedKey, JSON.stringify(models)],
    );

    // Free-tier sample agent so demo's first chat works zero-config.
    const free = models.find((m) => m.includes(":free")) ?? models[0];
    const agentId = cryptoIdLikeApp("agent");
    await client.query(
      `INSERT INTO agents
         (id, org_id, name, role, description, execution_mode, provider_id, model,
          current_prompt_version, tools, limits, intro, skills)
       VALUES ($1, $2, 'Hello', 'Free-tier assistant',
               'Free-tier sample agent powered by OpenRouter''s :free model. Rate-limited but costs nothing.',
               'one_shot', $3, $4, 'v1',
               '[]'::jsonb,
               $5::jsonb,
               $6::jsonb,
               $7::jsonb)`,
      [
        agentId,
        d.org.id,
        providerId,
        free,
        JSON.stringify({
          max_steps: 4,
          max_runtime_ms: 30_000,
          max_tool_calls: 0,
          max_tokens_per_run: 4_000,
        }),
        JSON.stringify([
          `Hi — I'm a sample agent running on ${free}.`,
          "Say anything to test the chat round-trip end-to-end.",
        ]),
        JSON.stringify([
          {
            label: "Tell me a fact",
            description: "Pick a topic and I'll surface one interesting fact.",
            try_first: true,
          },
          {
            label: "Help me write something",
            description: "Drafts, summaries, or rewrites — paste your text.",
          },
          {
            label: "Explain a concept",
            description: "Plain-language walkthroughs of jargon-heavy topics.",
          },
        ]),
      ],
    );
    await client.query(
      `INSERT INTO prompt_versions (id, agent_id, version, system_prompt, task_prompt, note)
       VALUES ($1, $2, 'v1',
               'You are a friendly, concise assistant. Answer in 1–3 short paragraphs.',
               '', 'Created with agent')`,
      [cryptoIdLikeApp("prm"), agentId],
    );

    console.log(`  seeded org + demo user + OpenRouter provider + free-tier "Hello" agent`);
  } else {
    console.log(`  seeded org + demo user (no OPENROUTER_API_KEY → empty workspace)`);
  }
}

// ── Tiny replicas of the runtime utilities so the seed doesn't need to
// transpile/import TypeScript. Keep these in sync with crypto.util.ts and
// id.util.ts.

function cryptoIdLikeApp(prefix) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}_${out}`;
}

function encryptSecretLikeApp(plain) {
  const raw = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!raw) throw new Error("PROVIDER_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`PROVIDER_ENCRYPTION_KEY must decode to 32 bytes; got ${key.length}.`);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
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
