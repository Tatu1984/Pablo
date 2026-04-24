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

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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
    const schema = await readFile(resolve(root, "sql/schema.sql"), "utf8");
    await client.query(schema);
    console.log("  schema.sql applied");

    console.log("→ seeding");
    await seed(client);
    console.log("✓ done");
  } finally {
    await client.end();
  }
}

async function seed(client) {
  const d = SEED;

  await client.query(
    `INSERT INTO orgs (id, name, plan, created_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [d.org.id, d.org.name, d.org.plan, d.org.created_at],
  );

  await client.query(
    `INSERT INTO users (id, email, password_hash, created_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING`,
    [d.user.id, d.user.email, d.user.password_hash, d.user.created_at],
  );

  await client.query(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES ($1,$2,'owner')
     ON CONFLICT DO NOTHING`,
    [d.org.id, d.user.id],
  );

  for (const p of d.providers) {
    await client.query(
      `INSERT INTO providers
         (id, org_id, name, type, base_url, key_prefix, encrypted_key, models, status, byo, created_at, last_used_at)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7::jsonb,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        d.org.id,
        p.name,
        p.type,
        p.base_url,
        p.key_prefix,
        JSON.stringify(p.models),
        p.status,
        p.byo,
        p.created_at,
        p.last_used_at,
      ],
    );
  }

  for (const a of d.agents) {
    await client.query(
      `INSERT INTO agents
         (id, org_id, name, role, description, execution_mode, provider_id, model,
          current_prompt_version, tools, limits, intro, skills, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        a.id,
        d.org.id,
        a.name,
        a.role,
        a.description,
        a.execution_mode,
        a.provider_id,
        a.model,
        a.current_prompt_version,
        JSON.stringify(a.tools),
        JSON.stringify(a.limits),
        JSON.stringify(a.intro),
        JSON.stringify(a.skills),
        a.created_at,
      ],
    );

    await client.query(
      `INSERT INTO prompt_versions (id, agent_id, version, system_prompt, task_prompt, note, created_at)
       VALUES ($1,$2,$3,$4,$5,'Seeded',$6)
       ON CONFLICT (agent_id, version) DO NOTHING`,
      [
        `prm_${a.id}_${a.current_prompt_version}`,
        a.id,
        a.current_prompt_version,
        "You are a disciplined operational agent.",
        "Input: {{ input_json }}",
        a.created_at,
      ],
    );
  }

  for (const r of d.runs) {
    await client.query(
      `INSERT INTO runs
         (id, org_id, agent_id, status, reason_code,
          tokens_in, tokens_out, cost_cents, step_count, tool_call_count,
          queued_at, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        d.org.id,
        r.agent_id,
        r.status,
        r.reason_code,
        r.tokens_in,
        r.tokens_out,
        r.cost_cents,
        r.step_count,
        r.tool_call_count,
        r.queued_at,
        r.started_at,
        r.finished_at,
      ],
    );

    const events = d.trace[r.id] ?? [];
    for (const e of events) {
      await client.query(
        `INSERT INTO run_events (run_id, seq, ts, type, summary, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (run_id, seq) DO NOTHING`,
        [r.id, e.seq, e.ts, e.type, e.summary, e.detail ? JSON.stringify(e.detail) : null],
      );
    }
  }

  console.log(
    `  seeded ${d.providers.length} providers, ${d.agents.length} agents, ${d.runs.length} runs`,
  );
}

// ─── inline seed (keep in sync with lib/mock.ts) ─────────────────────────────
const SEED = {
  org: { id: "org_demo", name: "Demo Org", plan: "starter", created_at: "2026-01-01T00:00:00Z" },
  user: {
    id: "user_demo",
    email: "demo@pablo.ai",
    password_hash: "$argon2id$placeholder",
    created_at: "2026-01-01T00:00:00Z",
  },
  providers: [
    {
      id: "prov_01",
      name: "OpenRouter (default)",
      type: "openrouter",
      base_url: "https://openrouter.ai/api/v1",
      key_prefix: "sk-or-v1-",
      models: [
        "minimax/minimax-m2.5:free",
        "openai/gpt-4o-mini",
        "anthropic/claude-haiku-4.5",
        "google/gemini-2.0-flash",
        "meta/llama-3.1-70b-instruct",
      ],
      status: "active",
      byo: false,
      created_at: "2026-02-01T08:00:00Z",
      last_used_at: "2026-04-24T07:12:00Z",
    },
    {
      id: "prov_02",
      name: "OpenAI — production",
      type: "openai",
      base_url: "https://api.openai.com/v1",
      key_prefix: "sk-proj-",
      models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
      status: "active",
      byo: true,
      created_at: "2026-03-10T10:00:00Z",
      last_used_at: "2026-04-22T15:30:00Z",
    },
    {
      id: "prov_03",
      name: "Anthropic",
      type: "anthropic",
      base_url: "https://api.anthropic.com",
      key_prefix: "sk-ant-",
      models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
      status: "active",
      byo: true,
      created_at: "2026-03-15T11:00:00Z",
      last_used_at: "2026-04-23T14:00:00Z",
    },
    {
      id: "prov_04",
      name: "Ollama (staging LAN)",
      type: "ollama",
      base_url: "http://10.0.0.42:11434/v1",
      key_prefix: null,
      models: ["llama3.1:70b", "qwen2.5:32b"],
      status: "active",
      byo: true,
      created_at: "2026-04-05T14:00:00Z",
      last_used_at: null,
    },
  ],
  agents: [
    {
      id: "agent_01HS3Y7K2M4NQ",
      name: "Atlas",
      role: "Sales Analyst",
      description: "Summarises orders, refunds, and CRM pipeline movement.",
      execution_mode: "one_shot",
      provider_id: "prov_01",
      model: "minimax/minimax-m2.5:free",
      current_prompt_version: "v4",
      tools: ["http.request", "json.transform"],
      limits: {
        max_steps: 12,
        max_runtime_ms: 60000,
        max_tool_calls: 20,
        max_tokens_per_run: 40000,
      },
      intro: [
        "Hey! I'm Atlas, your sales analyst. Ask me about yesterday's orders, trends, or plug me into your CRM.",
        "Here are a few skills to get you started, pick one below.",
      ],
      skills: [
        {
          label: "Summarise yesterday's sales",
          description: "Pull yesterday's orders, total revenue, and top SKUs.",
          try_first: true,
        },
        {
          label: "Week-over-week revenue",
          description: "Compare this week to last and highlight the movers.",
        },
        {
          label: "Flag unusual refunds",
          description: "Scan refunds and surface anything outside normal bounds.",
        },
      ],
      created_at: "2026-03-01T09:12:00Z",
    },
    {
      id: "agent_01HS3Y7K5PQRS",
      name: "Triage",
      role: "Support Router",
      description: "Classifies inbound tickets and routes them to the right queue.",
      execution_mode: "event_triggered",
      provider_id: "prov_03",
      model: "claude-haiku-4-5",
      current_prompt_version: "v12",
      tools: ["http.request", "webhook.trigger", "json.transform", "memory.read", "memory.write"],
      limits: {
        max_steps: 20,
        max_runtime_ms: 90000,
        max_tool_calls: 30,
        max_tokens_per_run: 60000,
      },
      intro: [
        "I'm Triage. Paste a ticket and I'll classify, prioritise, and route it to the right queue.",
        "Pick a canned skill, or just describe the ticket below.",
      ],
      skills: [
        {
          label: "Classify a new ticket",
          description: "Assign a category, priority, and next queue.",
          try_first: true,
        },
        {
          label: "Draft an acknowledgement",
          description: "First-response copy in your brand voice.",
        },
        {
          label: "Escalate to on-call",
          description: "Compose a PagerDuty page with the right context.",
        },
      ],
      created_at: "2026-02-14T14:02:00Z",
    },
    {
      id: "agent_01HS3Y7K9TVWX",
      name: "Pulse",
      role: "Metrics Reporter",
      description: "Pulls warehouse metrics and composes digests.",
      execution_mode: "multi_step_loop",
      provider_id: "prov_04",
      model: "llama3.1:70b",
      current_prompt_version: "v2",
      tools: ["http.request", "json.transform"],
      limits: {
        max_steps: 30,
        max_runtime_ms: 180000,
        max_tool_calls: 50,
        max_tokens_per_run: 120000,
      },
      intro: [
        "Pulse here. I pull weekly metrics from the warehouse and compose a digest.",
        "Kick me off with a pre-set routine or ask for something ad-hoc.",
      ],
      skills: [
        {
          label: "Run the weekly digest",
          description: "Warehouse query + stakeholder email, one pass.",
          try_first: true,
        },
        {
          label: "Diff against last week",
          description: "Surface any metric that moved more than 10%.",
        },
        {
          label: "Draft a board update",
          description: "One-page board memo from the raw numbers.",
        },
      ],
      created_at: "2026-04-05T11:40:00Z",
    },
  ],
  runs: [
    {
      id: "run_01HSAAAA1",
      agent_id: "agent_01HS3Y7K2M4NQ",
      status: "completed",
      reason_code: null,
      tokens_in: 2120,
      tokens_out: 488,
      cost_cents: 0,
      step_count: 4,
      tool_call_count: 2,
      queued_at: "2026-04-23T06:00:00Z",
      started_at: "2026-04-23T06:00:01Z",
      finished_at: "2026-04-23T06:00:11Z",
    },
    {
      id: "run_01HSAAAA2",
      agent_id: "agent_01HS3Y7K2M4NQ",
      status: "failed",
      reason_code: "tool_failure",
      tokens_in: 960,
      tokens_out: 120,
      cost_cents: 0,
      step_count: 2,
      tool_call_count: 1,
      queued_at: "2026-04-22T06:00:00Z",
      started_at: "2026-04-22T06:00:01Z",
      finished_at: "2026-04-22T06:00:06Z",
    },
    {
      id: "run_01HSAAAA3",
      agent_id: "agent_01HS3Y7K5PQRS",
      status: "running",
      reason_code: null,
      tokens_in: 1402,
      tokens_out: 0,
      cost_cents: 0,
      step_count: 3,
      tool_call_count: 2,
      queued_at: "2026-04-23T10:14:44Z",
      started_at: "2026-04-23T10:14:45Z",
      finished_at: null,
    },
    {
      id: "run_01HSAAAA4",
      agent_id: "agent_01HS3Y7K9TVWX",
      status: "queued",
      reason_code: null,
      tokens_in: 0,
      tokens_out: 0,
      cost_cents: 0,
      step_count: 0,
      tool_call_count: 0,
      queued_at: "2026-04-23T10:15:01Z",
      started_at: null,
      finished_at: null,
    },
  ],
  trace: {
    run_01HSAAAA1: [
      { seq: 1, ts: "2026-04-23T06:00:01Z", type: "started", summary: "Run started" },
      {
        seq: 2,
        ts: "2026-04-23T06:00:02Z",
        type: "llm_call",
        summary: "LLM call — plan next step",
        detail: { model: "minimax/minimax-m2.5:free", temperature: 0.2 },
      },
      {
        seq: 3,
        ts: "2026-04-23T06:00:03Z",
        type: "llm_result",
        summary: "Planned tool call: http.request",
      },
      {
        seq: 4,
        ts: "2026-04-23T06:00:04Z",
        type: "tool_call",
        summary: "http.request → GET /orders?day=2026-04-22",
      },
      {
        seq: 5,
        ts: "2026-04-23T06:00:07Z",
        type: "tool_result",
        summary: "200 OK, 1.2KB JSON body",
      },
      { seq: 6, ts: "2026-04-23T06:00:08Z", type: "llm_call", summary: "LLM call — summarise orders" },
      { seq: 7, ts: "2026-04-23T06:00:10Z", type: "llm_result", summary: "Final answer produced" },
      { seq: 8, ts: "2026-04-23T06:00:11Z", type: "completed", summary: "Run completed" },
    ],
    run_01HSAAAA2: [
      { seq: 1, ts: "2026-04-22T06:00:01Z", type: "started", summary: "Run started" },
      {
        seq: 2,
        ts: "2026-04-22T06:00:02Z",
        type: "tool_call",
        summary: "http.request → GET /orders?day=2026-04-21",
      },
      {
        seq: 3,
        ts: "2026-04-22T06:00:05Z",
        type: "tool_result",
        summary: "502 Bad Gateway after 3 retries",
      },
      {
        seq: 4,
        ts: "2026-04-22T06:00:06Z",
        type: "failed",
        summary: "Run failed — reason=tool_failure",
      },
    ],
    run_01HSAAAA3: [
      { seq: 1, ts: "2026-04-23T10:14:45Z", type: "started", summary: "Run started" },
      { seq: 2, ts: "2026-04-23T10:14:46Z", type: "llm_call", summary: "LLM call — classify ticket" },
      { seq: 3, ts: "2026-04-23T10:14:48Z", type: "llm_result", summary: "Tool decision: memory.read" },
      { seq: 4, ts: "2026-04-23T10:14:49Z", type: "tool_call", summary: "memory.read → key=policy/refunds" },
    ],
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
