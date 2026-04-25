-- Pablo — core schema (MVP subset of Developer Guide §9).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS orgs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id  TEXT NOT NULL REFERENCES orgs(id)  ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS providers (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  base_url       TEXT,
  key_prefix     TEXT,
  -- AES-256-GCM ciphertext of the provider API key. NULL for platform-managed.
  encrypted_key  TEXT,
  models         JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT  NOT NULL DEFAULT 'active',
  byo            BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS providers_org_idx ON providers(org_id);

CREATE TABLE IF NOT EXISTS agents (
  id                      TEXT PRIMARY KEY,
  org_id                  TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  role                    TEXT,
  description             TEXT,
  execution_mode          TEXT NOT NULL,
  provider_id             TEXT REFERENCES providers(id) ON DELETE RESTRICT,
  model                   TEXT NOT NULL,
  current_prompt_version  TEXT,
  input_schema            JSONB,
  output_schema           JSONB,
  tools                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  intro                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agents_org_idx ON agents(org_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS prompt_versions (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version           TEXT NOT NULL,
  system_prompt     TEXT,
  task_prompt       TEXT,
  tool_instructions TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE TABLE IF NOT EXISTS runs (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL,
  reason_code      TEXT,
  input            JSONB,
  output           JSONB,
  tokens_in        INTEGER NOT NULL DEFAULT 0,
  tokens_out       INTEGER NOT NULL DEFAULT 0,
  cost_cents       INTEGER NOT NULL DEFAULT 0,
  step_count       INTEGER NOT NULL DEFAULT 0,
  tool_call_count  INTEGER NOT NULL DEFAULT 0,
  queued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS runs_agent_queued_idx ON runs(agent_id, queued_at DESC);

-- Per-agent persistent memory (key/value JSON store), per dev guide §3.6.
-- Read and written by the memory.read / memory.write tools.
CREATE TABLE IF NOT EXISTS agent_memory (
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, key)
);

-- Append-only step trace; no updates, no deletes (see §9 invariant).
CREATE TABLE IF NOT EXISTS run_events (
  run_id  TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq     INTEGER NOT NULL,
  ts      TIMESTAMPTZ NOT NULL,
  type    TEXT NOT NULL,
  summary TEXT,
  payload JSONB,
  PRIMARY KEY (run_id, seq)
);
