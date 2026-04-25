---
title: "Pablo — Engineering Handbook"
subtitle: "What's built, how it fits together, how to run it, how to extend it"
audience: "Engineers (joining, contributing, deploying, fixing, or replicating)"
status: "Living document. Update this when you change behaviour."
---

# Pablo — Engineering Handbook

This is **the** reference for working on Pablo. The original
[`Developer_Guide.md`](./Developer_Guide.md) is the **product/design** doc — what
we're building and why. **This** is the **as-built engineering** doc — exactly
what's in the repo, where to find it, how to run it, and what's left.

If something here disagrees with the code, the code is right and this doc
needs updating in the same PR.

---

## TL;DR

- **Pablo** is a Next.js 14 (App Router) monolith that runs LLM agents.
- Single repo, single Node app, plus an optional separate **worker** process
  for async run execution.
- Postgres on **Neon** for state. Redis (optional) on **Upstash** or any
  managed host for the queue + rate-limit counters.
- Auth is cookie-session JWT for the dashboard, `Authorization: Bearer
  sk_live_…` for `/v1`. Both resolved by the same helper.
- LLM calls go through a single **gateway** with retry + tool-call support.
  Adapters: OpenAI-compatible (covers OpenRouter / OpenAI / Together / Ollama)
  and Anthropic.
- Tools: `http.request`, `webhook.trigger` (stub), `json.transform`,
  `memory.read`, `memory.write`. Multi-step LLM↔tool loop with hard limits.
- Trace is append-only (`run_events`), payloads truncated to 64 KB; no S3
  offload yet. Run detail page polls every 2 s while live.
- Quotas enforced per org per UTC month, before run insert. Stripe wired for
  checkout / portal / webhook (graceful no-op if env not configured).
- 13/13 vitest tests; GitHub Actions runs typecheck + tests + build on every
  push. Multi-stage Dockerfile builds `web` and `worker` images.

What's **not** here: S3 trace offload, OpenTelemetry, secrets manager,
streaming with tools, structured-output JSON-schema enforcement, email,
team invites, full `/v1` surface (only agents/runs subset). See
[Production gaps](#production-gaps).

---

## Repository layout

```
src/
  app/                              Next.js App Router
    (auth)/                         unauthenticated pages
      login/                        cookie-auth login form
      register/                     signup + auto-org + auto-provider + auto-agent
      layout.tsx
    (dashboard)/                    cookie-gated app shell + pages
      agents/[id]/                  chat, edit, runs/[run_id]
      providers/[id]/edit
      runs/                         org-wide run list + detail
      {usage,billing,keys,webhooks}/
      layout.tsx                    server component, hydrates session + agents
    api/                            **thin re-exports → backend handlers**
      auth/{login,logout,me,register}/
      agents/{,[id],[id]/{prompts,chat,runs}}/
      providers/{,[id],[id]/test}/
      runs/[id]/{,cancel}/
      keys/{,[id]}/
      webhooks/{,[id],[id]/test}/
      billing/{checkout,portal,webhook}/
      v1/                           public bearer-auth surface
        agents/{,[id],[id]/runs}/
        runs/[id]/{,cancel}/
    layout.tsx · page.tsx · globals.css

  backend/                          server-side logic; no React
    api/                            **actual handler implementations**
      auth/...                      register / login / logout / me
      agents/...                    CRUD + chat (SSE) + prompts
      providers/...                 CRUD + test
      runs/[id]/{,cancel}           polling + cancel
      keys/{,[id]}                  issue / list / revoke
      webhooks/{,[id],[id]/test}    register / list / delete / ping
      billing/{checkout,portal,webhook}
      v1/                           public-API handlers

    services/                       business logic
      auth.service.ts               register, login, userFromSession
      session.service.ts            currentSession / requireSession
      api-key.service.ts            issueApiKey, verifyApiKey, list/revoke
      v1-auth.service.ts            resolveRequestAuth (cookie or bearer)
      agent.service.ts              createAgent, updateAgent, archiveAgent,
                                    publishPromptVersion, autoProvisionStarterAgent
      provider.service.ts           createProvider (encrypts key), update,
                                    delete (transactional), test (probe /models),
                                    autoProvisionDefaultProvider
      run.service.ts                createRun dispatcher (one-shot streaming
                                    OR multi-step) + the streaming one-shot path
      runner.service.ts             multi-step LLM↔tool loop with hard limits
      quota.service.ts              assertCanRun, recordRunUsage, quotaForOrg
      stripe.service.ts             checkout / portal / webhook event apply
      webhook.service.ts            register, deliver (HMAC + retry), dispatchEvent

    repositories/                   pure SQL — every function takes orgId
      agent.repository.ts
      apiKey.repository.ts
      memory.repository.ts
      org.repository.ts
      provider.repository.ts        getProvider (no key) + getProviderEncrypted
      quota.repository.ts
      run.repository.ts             getRun, getTrace, insertRun, updateRun,
                                    insertRunEvent, cancelRun, getRunsForOrg,
                                    getAgentUsageForPeriod, getDailyRunCounts
      subscription.repository.ts
      user.repository.ts
      webhook.repository.ts

    gateway/                        LLM gateway
      types.ts                      LlmRequest/Response/Adapter, GatewayError
      adapters/openai-compatible.adapter.ts
      adapters/anthropic.adapter.ts
      index.ts                      pickAdapter + retry wrapper

    queue/
      connection.ts                 ioredis singletons + isQueueEnabled()
      runs.queue.ts                 BullMQ Queue + publishRunEvent (pub/sub)

    tools/
      types.ts                      Tool, ToolContext, ToolError, name mapping
      registry.ts                   getTool, listTools, toolsForAgent
      http-request.tool.ts          HTTPS-only, RFC1918/loopback blocked
      webhook-trigger.tool.ts       (Phase 8 stub)
      json-transform.tool.ts        dot-path get with `[index]`
      memory-read.tool.ts
      memory-write.tool.ts

    database/
      sql/schema.sql                idempotent CREATE TABLE IF NOT EXISTS …
      seed.mjs                      argon2-hashes "demo" pwd, drops in demo
                                    OpenRouter provider + free Hello agent
      client.ts                     pg.Pool singleton + transaction() helper

    utils/
      crypto.util.ts                AES-256-GCM (PROVIDER_ENCRYPTION_KEY)
      hash.util.ts                  argon2id wrapper
      jwt.util.ts                   jose HS256 sign/verify, SESSION_COOKIE
      id.util.ts                    Crockford-base32 newId(prefix)
      payload.util.ts               truncatePayload (64 KB cap)
      rate-limit.util.ts            sliding-window, redis or in-memory
      sign.util.ts                  HMAC-SHA256 webhook signer
      error-handler.util.ts         RFC-7807 problem+json helpers

    validators/                     zod schemas
      agent.validator.ts
      auth.validator.ts
      provider.validator.ts
      webhook.validator.ts

    services/...                    (above)

  frontend/                         client-rendered React
    components/
      ui/                           StatusBadge, ProviderBadge, ThemeToggle,
                                    JsonView (collapsible + copy)
      layout/                       AppShell, Sidebar, PageFrame, PageHeader,
                                    ThemeScript
      features/
        agents/                     ChatConversation, ProviderModelPicker,
                                    NewAgentForm, EditAgentConfigForm,
                                    PromptEditor, ArchiveAgentButton
        providers/                  EditProviderForm, ProviderRowActions
        billing/                    PlanSwitchButtons
        webhooks/                   RegisterWebhookForm, WebhookRowActions
        keys/                       IssueKeyDialog, RevokeKeyButton
        runs/                       RunDetail (live polling + kill),
                                    RunsTable, StatusFilter
        auth/                       LoginForm, RegisterForm
    utils/formatters.ts             fmtDate, statusColor

  shared/                           types + constants used by both sides
    types/{agent,provider,run,user}.types.ts + index.ts
    constants/{tools,providers,plans}.ts

  config/env.ts                     centralised env reader

  worker/index.ts                   BullMQ worker entrypoint (tsx)
  middleware.ts                     edge-runtime auth gate

tests/unit/                         vitest
  crypto.test.ts
  plans.test.ts
  payload.test.ts
  webhook-signing.test.ts

.github/workflows/ci.yml            typecheck + test + build on every push
Dockerfile                          multi-stage: web + worker targets
docker-compose.yml                  local Redis only
README.md                           quick-start + production checklist
ENGINEERING_HANDBOOK.md             ← this file
Developer_Guide.md                  original product/design doc
```

### Naming convention — the `app/api` ↔ `backend/api` split

Next.js requires route handlers under `src/app/api/<path>/route.ts`. We
keep those files **one line each**, re-exporting from the actual
implementation under `src/backend/api/<path>/route.ts`. Reasons:

1. The real logic lives in a flat, predictable place that can be lifted
   wholesale to a Fastify control plane later (the dev guide's eventual
   target) with no rename pass.
2. Tests + scripts can import handlers directly from `@/backend/api/...`
   without depending on Next.js's routing conventions.

When you add a new endpoint, **always**:
1. Write the handler in `src/backend/api/<path>/route.ts`.
2. Add the one-line re-export in `src/app/api/<path>/route.ts`.

### Where things should live

| You're adding... | Put it in |
|---|---|
| A new HTTP endpoint | `backend/api/<resource>/route.ts` (+ re-export under `app/api`) |
| Business logic | `backend/services/<topic>.service.ts` |
| A SQL query | `backend/repositories/<table>.repository.ts` |
| Validation | `backend/validators/<topic>.validator.ts` (zod) |
| A general helper | `backend/utils/<purpose>.util.ts` |
| A reusable React UI primitive | `frontend/components/ui/<Name>.tsx` |
| A page-shaped layout block | `frontend/components/layout/<Name>.tsx` |
| A feature-specific React form | `frontend/components/features/<feature>/<Name>.tsx` |
| Types shared by both server + client | `shared/types/<topic>.types.ts` |
| Static constants (plans, tool defs, provider catalog) | `shared/constants/<topic>.ts` |
| A unit test | `tests/unit/<topic>.test.ts` |

---

## Tech stack (and why)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Node 22** | `--env-file` native; native `fetch`. CI pins 22. |
| Framework | **Next.js 14 App Router** | RSC for server-rendered pages, route handlers for `/api/*`. We avoided Pages Router. |
| Language | **TypeScript** strict | `tsconfig` is strict; `tsc --noEmit` runs in CI. |
| DB | **Postgres** via **`pg`** | Plain SQL, no ORM. Connection pool singleton survives HMR. |
| DB host | **Neon** | TCP+TLS pooler URL works fine; Neon's serverless HTTP driver isn't used. |
| Queue | **BullMQ** on **ioredis** | Optional — falls back to inline runs if `REDIS_URL` is unset. |
| Auth | **`@node-rs/argon2`** + **`jose`** | Argon2id for passwords. HS256 JWT in httpOnly cookie. `jose` is edge-runtime safe. |
| Validation | **`zod`** | Every write endpoint validates; `validationError()` returns RFC-7807. |
| LLM HTTP | **plain `fetch`** | Adapters speak the wire format directly; no SDK pinning. |
| Stripe | **`stripe`** | Lazy-imported so unrelated requests don't pay the cost. |
| Tests | **`vitest`** | Fast, ESM-native, alias-aware via `vitest.config.ts`. |
| CI | **GitHub Actions** | Typecheck + test + build. |
| Deploy | **Vercel** (web) + any Node host (worker) | See [Deployment](#deployment). |
| Local Redis | **`docker-compose.yml`** | One service, port 6379. |

Things we **didn't** use (and why):

- **Prisma / Drizzle** — repository pattern with hand-written SQL is fewer
  moving parts and more readable. Cost: schema changes require manual SQL.
- **NextAuth / Auth.js** — too much abstraction; rolling our own is ~150
  lines and we own the session shape.
- **TRPC** — the public `/v1` surface needs to be plain HTTP / OpenAPI-able;
  the dashboard `/api` mirrors it for symmetry.
- **Edge runtime everywhere** — only `middleware.ts` is edge. Route
  handlers + server components run on Node, because `pg`, `argon2`, and
  `stripe` need it.

---

## Local setup

```bash
git clone git@github.com:Tatu1984/Pablo.git
cd Pablo
npm ci

# environment
cp .env.example .env.local
echo "JWT_SECRET=$(openssl rand -base64 32)"             >> .env.local
echo "PROVIDER_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
# fill DATABASE_URL with your Neon URL
# (optional) fill OPENROUTER_API_KEY to get auto-provider + Hello agent

npm run db:init      # creates tables + seeds demo@pablo.ai / demo
npm run dev          # http://localhost:3000

# in another terminal, optionally:
docker compose up -d redis
# uncomment REDIS_URL in .env.local
npm run worker       # async run worker
```

Sign in with `demo@pablo.ai` / `demo`. If you set `OPENROUTER_API_KEY`,
the demo org has a working chat agent ready ("Hello"); otherwise it's
empty and you can register a fresh org via `/register`.

---

## Environment variables

Single source of truth: `src/config/env.ts`. Every variable below is
either **required** (the app refuses to start without it) or **optional**
(feature degrades gracefully when missing).

| Var | Required | Used by | Notes |
|---|---|---|---|
| `DATABASE_URL` | **yes** | `backend/database/client.ts` | Postgres URL with `sslmode=require`. |
| `JWT_SECRET` | **yes** | `backend/utils/jwt.util.ts` | 32-byte base64. Sign session JWTs (HS256). |
| `PROVIDER_ENCRYPTION_KEY` | **yes** | `backend/utils/crypto.util.ts` | 32-byte base64. AES-256-GCM key for BYO provider keys. |
| `NEXT_PUBLIC_APP_URL` | recommended | client links + Stripe URLs + OpenRouter `HTTP-Referer` | Defaults to `http://localhost:3000`. **Set this in production.** |
| `OPENROUTER_API_KEY` | optional | `auth.service.register` + seed | If set, every new org gets an auto-provisioned BYO OpenRouter provider populated from this value. Users can rotate from the UI. |
| `OPENROUTER_BASE_URL` | optional | OpenRouter adapter | Default `https://openrouter.ai/api/v1`. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` | optional | not auto-wired | Reserved; users add via `/providers/new`. |
| `REDIS_URL` | optional | queue + worker + rate limiter | When set, chat runs go through BullMQ; rate limits use Redis sliding window. When unset, runs inline; rate limits use in-memory map. |
| `STRIPE_SECRET_KEY` | optional | `stripe.service` | When set, `/billing` shows Upgrade button; checkout creates a real Stripe session. |
| `STRIPE_WEBHOOK_SECRET` | optional | `/api/billing/webhook` | Required for Stripe to reach you. |
| `STRIPE_PRICE_PRO` | optional | `stripe.service.createCheckoutSession` | Stripe price id for the Pro plan. |
| `STRIPE_API_VERSION` | optional | `stripe.service` | Default = your Stripe account's active version. |
| `WEBHOOK_SIGNING_SECRET` | optional | reserved (per-webhook secrets are issued at register time, not env) | Kept in `.env.example` for symmetry with dev guide §7.7. |
| `LOG_LEVEL` | optional | `console.*` (no structured logger yet) | Default `info`. |

Variables in `.env.local` are gitignored. `.env.example` is the
public-safe template.

---

## Database

Schema lives in **`src/backend/database/sql/schema.sql`**. It's idempotent
(`CREATE TABLE IF NOT EXISTS …`). Apply with `npm run db:init`, which
runs `seed.mjs`, which:

1. Applies the whole schema.
2. Upserts `org_demo` + `demo@pablo.ai` (password: `demo`, argon2-hashed).
3. **Wipes** all `org_demo` content (`agents`, `providers`, `runs`,
   `run_events`, `prompt_versions`, `agent_memory`) — fresh slate every
   run.
4. If `OPENROUTER_API_KEY` is set: drops in an OpenRouter provider with
   the key encrypted using the same scheme the running app uses, plus a
   free-tier "Hello" agent on `minimax/minimax-m2.5:free`.

### Tables (current state)

```
orgs                (id, name, plan, created_at)
users               (id, email, password_hash, created_at)
org_members         (org_id, user_id, role)               PK (org_id, user_id)

api_keys            (id, org_id, name, prefix, hash, created_by,
                     created_at, last_used_at, revoked_at)
                    idx api_keys_hash_idx WHERE revoked_at IS NULL
                    idx api_keys_org_idx

webhooks            (id, org_id, url, events JSONB, secret,
                     created_at, disabled_at)
                    idx webhooks_org_idx WHERE disabled_at IS NULL

webhook_deliveries  (id, webhook_id, event, payload JSONB, status,
                     attempt, last_status, last_error,
                     created_at, last_attempt_at)
                    idx webhook_deliveries_wh_idx (webhook_id, created_at DESC)

subscriptions       (org_id, plan, status,
                     stripe_customer_id, stripe_sub_id,
                     current_period_end, updated_at)        PK org_id

quotas              (org_id, period, runs_used, runs_limit,
                     tokens_used, tokens_limit, cost_cents_used,
                     updated_at)                            PK (org_id, period)
                    idx quotas_org_period_idx (org_id, period DESC)

providers           (id, org_id, name, type, base_url,
                     key_prefix, encrypted_key, models JSONB,
                     status, byo, created_at, last_used_at)
                    idx providers_org_idx

agents              (id, org_id, name, role, description,
                     execution_mode, provider_id, model,
                     current_prompt_version,
                     input_schema JSONB, output_schema JSONB,
                     tools JSONB, limits JSONB, intro JSONB, skills JSONB,
                     archived_at, created_at)
                    idx agents_org_idx WHERE archived_at IS NULL

prompt_versions     (id, agent_id, version,
                     system_prompt, task_prompt, tool_instructions,
                     note, created_at)                     UNIQUE (agent_id, version)

agent_memory        (agent_id, key, value JSONB, updated_at)  PK (agent_id, key)

runs                (id, org_id, agent_id, status, reason_code,
                     input JSONB, output JSONB,
                     tokens_in, tokens_out, cost_cents,
                     step_count, tool_call_count,
                     queued_at, started_at, finished_at)
                    idx runs_agent_queued_idx (agent_id, queued_at DESC)

run_events          (run_id, seq, ts, type, summary, payload JSONB)
                    PK (run_id, seq)
                    -- append-only; no UPDATE / DELETE allowed
```

### Migrations

There **isn't** a migration tool yet. `db:init` is idempotent for
**additive** changes — adding columns / tables / indexes — but it can't
rename, drop, or backfill. Production schema changes today are:

```
1. Edit schema.sql to add the new column / table.
2. Open a psql session against prod and run the additive DDL by hand.
3. Push code that uses it.
```

If you need a **breaking** change, write a one-off SQL migration and
run it manually before deploy. **Add a real migration tool
(`drizzle-kit`, `goose`, `node-pg-migrate`) before you have customers**;
this is a documented Phase-9 gap.

### Conventions

- **Every repository function takes `orgId` as the first argument.** Cross-
  org access is impossible via repositories.
- **Timestamps in JSON responses** are ISO-8601 strings. We `to_char()`
  in SQL so we never leak Postgres `Timestamp` types.
- **Foreign keys** use `ON DELETE CASCADE` for parent→child and
  `ON DELETE RESTRICT` for cross-cutting refs (e.g.
  `agents.provider_id → providers.id`). The provider-delete service
  nulls out archived agents' `provider_id` inside a transaction before
  dropping the row, since they don't need provider routing anymore.

---

## Authentication & sessions

**Two auth surfaces**, both resolved by `backend/services/v1-auth.ts ::
resolveRequestAuth`:

1. **Cookie session** — used by the dashboard.
   - `POST /api/auth/register` and `/api/auth/login` set `pablo_session`
     httpOnly + SameSite=lax + (in prod) Secure.
   - JWT is HS256, signed with `JWT_SECRET`. Claims: `{user_id, org_id,
     email}`. TTL 7 days.
   - Edge `middleware.ts` 307s anonymous users to `/login?next=…` and
     307s logged-in users away from `/login` and `/register`.
   - Server components call `requireSession()` from
     `backend/services/session.service.ts`. It hydrates user + org from
     the JWT and re-validates membership against the DB.

2. **API key (bearer)** — used for `/v1/*`.
   - Issued at `POST /api/keys` (cookie-auth). Server generates
     `sk_live_<24-byte b64url>`, stores **only** the SHA-256 hash + a
     12-char prefix. Plaintext is shown in the modal once.
   - `verifyApiKey(plain)` recomputes the hash and looks up the row.
     `last_used_at` is bumped fire-and-forget so the auth path stays fast.
   - `Authorization: Bearer sk_live_…` is the only accepted header.

`resolveRequestAuth` tries bearer first, then cookie. Returns
`{org_id, user_id?, api_key_id?, source}` or `null`.

The middleware allow-list (`PUBLIC_PREFIXES`):

```
/login   /register   /api/auth   /v1   /api/v1   /api/billing/webhook
```

`/v1` and `/api/billing/webhook` enforce their own auth inside the
handler (bearer + signature respectively).

---

## LLM Gateway

`src/backend/gateway/`. The runner never talks to a provider directly —
it builds an `LlmRequest` and hands it to the gateway.

### Request / response shape

```ts
interface LlmRequest {
  provider: Provider;            // type + base_url
  apiKey: string | null;         // null OK for ollama / bedrock-iam
  model: string;
  messages: LlmMessage[];        // {role, content, tool_calls?, tool_call_id?, name?}
  tools?: LlmToolDef[];          // {name, description, parameters}
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

interface LlmResponse {
  content: string;
  tool_calls?: LlmToolCall[];    // {id, name, arguments}
  model: string;
  usage: { prompt_tokens, completion_tokens, total_tokens };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  raw?: unknown;                 // original body for debugging
}
```

### Adapters

- **`openai-compatible.adapter.ts`** — OpenRouter, OpenAI,
  OpenAI-compatible (Together, Groq, Fireworks, vLLM), Ollama. Handles
  both streaming (`callLlm` + `streamLlm`) and tool calls (incoming
  deltas reassembled by index, outgoing `tool_calls` encoded as
  function-call objects).
- **`anthropic.adapter.ts`** — Messages API. Encodes outgoing
  `LlmMessage[]` into Anthropic's content-array format (`tool_use` /
  `tool_result` blocks); decodes content blocks back into
  `LlmResponse.tool_calls`. Non-streaming only.

Adding a new provider type:

1. Add the literal to `ProviderType` in `shared/types/provider.types.ts`.
2. Add a `PROVIDER_TYPES` entry in `shared/constants/providers.ts`.
3. Write an adapter in `backend/gateway/adapters/<name>.adapter.ts`
   implementing `LlmAdapter` (at minimum, `call`).
4. Wire it into `pickAdapter()` in `backend/gateway/index.ts`.
5. Update `provider.service.testProvider` if the provider has a different
   model-list endpoint.

### Retry + timeout

`withRetry` wraps every gateway call:
- 3 attempts at `[250, 500, 1000]` ms backoff.
- Retries only on `429` / 5xx / network errors / timeout.
- Per-attempt `AbortController` with 60 s timeout.

Errors are typed: `GatewayError` with `code` ∈ {`provider_unsupported`,
`missing_key`, `rate_limited`, `bad_request`, `upstream`, `timeout`,
`network`, `tools_unsupported`}. The chat route surfaces these to SSE
as `failed { code, detail }` events.

---

## Run engine

Two execution paths, dispatched by `run.service.createRun(opts)` based
on `agent.tools.length`:

### Path A — one-shot streaming (no tools)

`run.service.createOneShotRun`:

1. Quota guard (`assertCanRun`) — throws `QuotaError` if over limits.
2. Insert `runs` row in `running` state, emit `started` event.
3. Build messages: system pieces from `prompt_version` + last 20
   completed runs (paired user/assistant from `runs.input.message` and
   `runs.output.message`) + the new user message.
4. Decrypt provider key, call `streamLlm()` with `onDelta` piping chunks
   to the SSE handler.
5. On success: append `llm_call`, `llm_result`, `completed` events,
   update `runs` with output + usage + final state, touch
   `provider.last_used_at`, **fire `execution.completed` webhook**,
   record quota usage.
6. On error: append `failed` event, set `runs.reason_code`,
   **fire `execution.failed` webhook**, propagate.

### Path B — multi-step runner (tools present)

`runner.service.createMultiStepRun`:

```
loop:
  pre-checks: max_runtime_ms, max_tokens_per_run, max_steps
  cancel-check: SELECT status FROM runs WHERE id=$1; if 'cancelled' → throw
  llm_call event (with full messages, tool defs)
  callLlm({tools})            ← non-streaming inside the loop
  llm_result event (with content, usage, tool_calls)
  if response.tool_calls is empty → final answer; emit single delta;
                                    completed event; webhook; quota; break
  else: push assistant message (with tool_calls) into messages
        for each tool_call:
          tool_call event (name + arguments)
          dispatch via registry; capture result
          tool_result event (ok/failed + truncated result)
          push tool message into messages
        check max_tool_calls, then continue loop
```

Limits are enforced **before** the next LLM call so a 5-step agent stops
at step 5 even if it was about to issue more tool calls.

### Streaming behaviour

- One-shot path: real token-by-token streaming.
- Multi-step path: non-streaming inside the loop; the final answer is
  emitted as a single `delta` chunk. **Streaming with tool-calls is
  intentionally not built** — it adds significant adapter complexity
  for a UX gain that's currently absorbed by the "Last run" link.

### Worker (queued path)

When `REDIS_URL` is set:
- The chat handler enqueues a BullMQ job and subscribes to the per-run
  pub/sub channel (`pablo:run:<run_id>`).
- The worker (`src/worker/index.ts`) pulls the job, runs `createRun`
  with `onEvent` / `onDelta` callbacks that publish to the channel.
- The chat handler pipes published events to the SSE stream and closes
  on `completed` / `failed`.
- **The run survives the chat tab being closed.** That's the whole
  point of the queue path.

When `REDIS_URL` is unset, the chat handler runs `createRun` inline.

---

## Tools

Five built-ins under `src/backend/tools/`. Each implements the same
`Tool` interface with `name`, `description`, `input_schema`,
`output_schema`, and `execute(input, ctx)`.

| Tool | What it does | Notable |
|---|---|---|
| `http.request` | Make GET/POST/etc. | HTTPS-only by default; loopback + RFC1918 + 169.254 + 0.0.0.0/8 blocked; 10 s timeout; 1 MB body cap. |
| `webhook.trigger` | (stub) | Errors with `unsupported`. Lands when the registered webhook flow gets exposed inside an agent context. |
| `json.transform` | Dot-path get on JSON | Supports `[index]` for arrays. Returns `{value, found}`. |
| `memory.read` | Read agent KV memory | Backed by `agent_memory` table. |
| `memory.write` | Write agent KV memory | 100 KB value cap. |

### Adding a new tool

1. Create `backend/tools/<name>.tool.ts`. Export an object implementing
   `Tool` from `backend/tools/types.ts`.
2. Register it in `backend/tools/registry.ts` (add to the `TOOLS`
   array — order is preserved when filtering by allowlist).
3. Optionally add to `shared/constants/tools.ts` so the agent-create UI
   surfaces it as an option.
4. Tool function names in the LLM protocol can't contain dots; the
   gateway maps `http.request` ↔ `http_request` automatically.

The runner gives every tool a `ToolContext` with `{orgId, agentId,
runId, ephemeral: Map}`. The `ephemeral` map is per-run scratch — it
dies with the run.

---

## Observability (run trace)

### What gets recorded

Every run has rows in `run_events` (append-only, primary key
`(run_id, seq)`). Event types: `started`, `llm_call`, `llm_result`,
`tool_call`, `tool_result`, `completed`, `failed`, `cancelled`.

Payloads are truncated by `backend/utils/payload.util.truncatePayload`:
- 64 KB total per row.
- 16 KB per individual string.
- Oversized strings are sliced with a `…[truncated N chars]` marker.
- Oversized arrays/objects get a `__truncated: true` field.

What's in each payload:

| Event | Payload |
|---|---|
| `started` | `null` |
| `llm_call` | `{model, step, message_count, messages, tools}` |
| `llm_result` | `{usage, finish_reason, content, tool_calls}` |
| `tool_call` | `{tool_call_id, name, arguments}` |
| `tool_result` | `{tool_call_id, name, ok, result}` |
| `completed` | `null` |
| `failed` | `{detail}` |

### Dashboard

- `/runs` — org-wide listing with status filter.
- `/agents/<id>/runs` — agent-scoped listing.
- `/agents/<id>/runs/<run_id>` — full trace, expandable cards per step,
  copy-as-JSON, live polling every 2 s while status is queued/running,
  kill-run button while live.

### Polling endpoint

`GET /api/runs/<id>` returns `{run, trace}`. The detail page hits this
on a 2 s interval and stops on terminal status. Cheap; could be replaced
with SSE in a future iteration.

### Kill switch

`POST /api/runs/<id>/cancel` → `cancelRun()` flips
`runs.status = 'cancelled'` and sets `reason_code = 'user_cancelled'`.
The runner (both inline and worker) calls `wasCancelled(runId)` before
each LLM call; if true it throws `RunnerError("runtime_exceeded")` and
the catch block records a `failed` event with `cancelled` semantics.

This is **cooperative**: a long LLM call already in flight will finish.
We don't kill the upstream HTTP request mid-flight; the next step
boundary is the cut point.

---

## Quotas, plans, and Stripe

### Plan tiers

`src/shared/constants/plans.ts` is the single source of truth:

| Plan | Price | Runs / mo | Tokens / mo |
|---|---|---|---|
| Starter | free | 100 | 500 K |
| Pro | $29 | 2 000 | 10 M |
| Enterprise | contact | 100 K | 1 B |

Limits are **read from this file at runtime** — Stripe just decides
which plan id is on which org.

### Period model

`currentPeriod()` returns `YYYY-MM` UTC. Quotas are keyed
`(org_id, period)`. Old periods stay as history; new periods upsert
lazily at the first run of the month (`quotaForOrg(orgId)`).

### Enforcement

Both run paths call `assertCanRun(orgId)` **before** `insertRun`.
Throws `QuotaError("runs_exceeded")` or `QuotaError("tokens_exceeded")`
with the live row attached. The chat SSE surfaces this as a
`failed { code, detail, quota }` event with HTTP 429 in the `/v1` path.

After a successful terminal state, `recordRunUsage(orgId, in, out)`
fire-and-forget bumps `runs_used += 1` and `tokens_used += in + out`.

### Stripe

`backend/services/stripe.service.ts` lazily imports the SDK so unrelated
requests don't pay the cost.

- `createCheckoutSession` — subscription mode, line item from
  `STRIPE_PRICE_PRO`, metadata `{org_id, plan}`, success/cancel URLs at
  `${NEXT_PUBLIC_APP_URL}/billing`.
- `createPortalSession` — for cancellation / payment method updates.
- `verifyAndConstructEvent` + `applyStripeEvent` — webhook receiver.
  Handles `checkout.session.completed`, `customer.subscription.{created,
  updated, deleted}`. Idempotent.

When Stripe env isn't set, `/billing` shows a one-line note explaining
which env vars are needed; the buttons are hidden. The webhook returns
500 with a clear message.

---

## Public `/v1` API

All endpoints are bearer-auth. Errors are RFC-7807
`application/problem+json` with a typed `code`.

### Implemented

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/agents` | GET | list active agents |
| `/v1/agents/{id}` | GET | fetch one |
| `/v1/agents/{id}/runs` | POST | start a run; body `{input:{message}}` or `{message}`; returns 202 + result |
| `/v1/agents/{id}/runs` | GET | list runs for the agent |
| `/v1/runs/{id}` | GET | `{run, trace}` |
| `/v1/runs/{id}/cancel` | POST | cooperative cancel |

### Curl recipe

```bash
KEY="sk_live_…"

# list agents
curl https://your-host/v1/agents -H "Authorization: Bearer $KEY"

# kick off a run
curl https://your-host/v1/agents/agent_xxx/runs \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"What did sales look like yesterday?"}'

# fetch the trace
curl https://your-host/v1/runs/run_xxx -H "Authorization: Bearer $KEY"
```

### Deferred (Phase 9+)

- `/v1/keys`, `/v1/usage`, `/v1/quotas`, `/v1/webhooks`,
  `/v1/memory`, `/v1/tools`, `/v1/billing/*`. Mostly mechanical: the
  services + repositories are all there; they just need handlers.
- `Idempotency-Key` header support per dev guide §7. Not enforced today.

---

## Webhooks

### Registration

`POST /api/webhooks` (cookie-auth):

```json
{
  "url": "https://hooks.example.com/pablo",
  "events": ["execution.completed", "execution.failed"]
}
```

Server generates a per-webhook `whsec_<24-byte b64url>` signing secret
and returns it **once** in the response body.

Five recognized events (declared in
`backend/services/webhook.service.ts :: ALL_EVENTS`):

```
execution.completed
execution.failed
execution.cancelled
quota.threshold        ← declared, not yet fired
subscription.updated   ← declared, not yet fired
```

### Signing

Every delivery carries:

```
X-Pablo-Signature: t=<unix_ts>,v1=<hex hmac-sha256 of `${ts}.${body}`>
```

The signing helper lives in `backend/utils/sign.util.ts` (extracted so
tests can import it without pulling in the DB pool). On the receiver
side, validate by re-computing HMAC with the secret you got at registration
and constant-time-comparing.

### Delivery

`deliverEvent` inserts a `webhook_deliveries` row and attempts the POST
up to 4 times at `[0, 1s, 5s, 30s]`. Each attempt updates the row's
`status`, `attempt`, `last_status`, `last_error`, `last_attempt_at`.
Status values: `pending` → `retrying` → `delivered` | `failed`.

`dispatchEvent(orgId, event, payload)` fans out to all subscribers
(`Promise.allSettled`). Called fire-and-forget from terminal points in
the run paths so the SSE handler doesn't wait on it.

### Inspecting deliveries

`/webhooks` page lists endpoints + recent deliveries with their status.
Test button on each row hits `POST /api/webhooks/{id}/test` which fires
a one-shot `event: "test"` payload.

**Not built**: dead-letter queue / replay UI for failed deliveries.

---

## Rate limiting

`backend/utils/rate-limit.util.ts` — sliding window.

- **Redis path** (`REDIS_URL` set): pipelined `INCR` + `EXPIRE NX` + `PTTL`.
  TTL goes into the `Retry-After` header.
- **In-memory path** (no Redis): `Map<string, {count, resetAt}>` keyed
  off `globalThis` so HMR doesn't reset.

Limits today:

| Endpoint | Limit | Key |
|---|---|---|
| `POST /api/auth/login` | 10 / min | `auth:login:<ip>` |
| `POST /api/auth/register` | 5 / min | `auth:register:<ip>` |
| `POST /api/agents/[id]/chat` | 30 / min | `chat:<user_id>` |
| `POST /v1/agents/[id]/runs` | 60 / min | `v1:runs:<api_key_id or org_id>` |

Adding a new limit: import `rateLimit` + `tooManyRequests` from
`backend/utils/rate-limit.util.ts`, call before the work, return early
if `!allowed`.

---

## Worker process

`src/worker/index.ts` is a standalone Node entrypoint started with `npm
run worker`. It:

1. Creates a BullMQ Worker on `pablo:runs`, concurrency from
   `WORKER_CONCURRENCY` (default 4).
2. For each job, calls `createRun({orgId, agentId, userMessage, onDelta,
   onEvent})` and pipes events to the per-run pub/sub channel via
   `publishRunEvent`.
3. Handles SIGTERM / SIGINT to drain cleanly.

It runs the **same** services the inline path runs — the only
difference is where the events go. So feature additions in the runner
benefit both paths.

If `REDIS_URL` is unset on the worker, it exits with an error. If
`DATABASE_URL` is unset, same thing.

### What needs to be done for the worker

**Today**: the worker code works locally and via Docker, but the
production wiring is incomplete. Before you deploy, walk through this
list. Items in **bold** are blockers; the rest are scaling concerns.

#### Hosting

The Next.js app deploys cleanly to Vercel. The worker **cannot** —
Vercel only runs serverless functions, not long-lived processes.
Pick one of:

| Host | Notes |
|---|---|
| **Fly.io** | Docker-native; cheap; `fly launch` then `fly deploy` against the worker target. Easy graceful shutdowns. **Recommended.** |
| **Railway** | Docker-native; simpler UI than Fly; pay-as-you-go. |
| **Render** | Background Worker service type fits exactly. |
| **AWS ECS Fargate** | Most control; most setup. Justified at scale. |
| **GCP Cloud Run Jobs** | Works for short-lived; not ideal for always-on workers. |
| **Plain VPS** (DigitalOcean / Hetzner / EC2) | Run via `pm2` or systemd. Most flexibility, most ops. |

Build with:

```
docker build --target worker -t pablo-worker .
```

Required env vars on the worker host:

- `DATABASE_URL` — same Neon URL the web has.
- `REDIS_URL` — same Redis the web has. Worker subscribes to the same
  `pablo:runs` queue + per-run channels.
- `PROVIDER_ENCRYPTION_KEY` — to decrypt provider keys when calling LLMs.
- `OPENROUTER_API_KEY` (or whatever your default provider uses) — only
  if you want auto-provisioned providers to work; the runner reads keys
  from `providers.encrypted_key` for BYO providers.
- `JWT_SECRET` — not used by the worker today, but the env validator
  in `src/config/env.ts` insists on it. Either set it or relax the
  validator for the worker.
- `WORKER_CONCURRENCY` — number of jobs in flight per worker. Default 4.
- `WORKER_ID` — friendly id for logs. Default `wkr-<pid>`.

#### Blockers before you can serve real customers

1. **No `/healthz` endpoint.** Most hosts want an HTTP health check.
   Add a tiny http server in `src/worker/index.ts` that responds 200
   while `worker.isRunning()` is true. Wire it to `WORKER_HEALTH_PORT`.
2. **Job retries are off.** BullMQ default `attempts: 1` is set on the
   queue (`runs.queue.ts`). For transient LLM/DB failures we'd want
   `attempts: 3` with exponential backoff. **Mind double-billing**: if
   we re-attempt, `assertCanRun` runs again *and* `recordRunUsage`
   could fire twice for the same run. Decide between (a) accept double
   billing on retry, or (b) idempotency keyed on `runId`.
3. **No process-level error handler.** An uncaught exception inside a
   tool implementation will crash the worker. Add:
   ```ts
   process.on("unhandledRejection", (e) => console.error("unhandled:", e));
   process.on("uncaughtException",  (e) => console.error("uncaught:", e));
   ```
   And consider letting the host restart on uncaught exceptions
   (cleaner than swallowing).
4. **Stalled-job recovery isn't tuned.** BullMQ has a `stalledInterval`
   and `maxStalledCount`. Defaults are sane but should be reviewed: a
   long LLM call (60s + retries) could trip the stalled detector and
   cause a duplicate run. Consider setting `lockDuration` ≥ the
   gateway timeout × max attempts.
5. **No graceful-shutdown timeout aligned with the host.** SIGTERM
   triggers `worker.close()` which drains, but Fly / ECS / k8s give
   you a fixed window (10–30s default). If a long LLM call is in
   flight when shutdown starts, it'll be killed mid-flight and the
   run will be marked `failed`. Either:
   - increase the host's `kill_timeout` to match `max_runtime_ms`, or
   - set the BullMQ worker's drain to abort cleanly with a
     `cancelled` reason instead of leaving the run dangling.
6. **No deploy parity check.** If the worker is running an older
   version of `runner.service` than the web (e.g. with new run-event
   payload shapes), the trace UI breaks. Either deploy them together
   atomically, or version the queue (`pablo:runs:v2`) and migrate.

#### Scaling concerns (matter at >100 runs/hr)

7. **DB connection pool sizing.** Each worker process holds a `pg.Pool`
   with `max: 5`. With `WORKER_CONCURRENCY: 4`, that's tight. Bump to
   `max: 10` once we exercise real concurrency, or move to a transaction
   pooler.
8. **Concurrent webhook deliveries.** When 50 runs complete at once,
   `dispatchEvent` fires 50 fan-outs each with up to 4 retry attempts.
   That's a lot of outbound HTTP. Add a delivery queue (could be the
   same BullMQ instance with a `pablo:webhooks` queue) so we don't
   block worker slots on webhook RTTs.
9. **Heartbeat to the control plane.** Dev guide §5.3 mentions a
   `runs.heartbeat` topic so the API server can show "worker is still
   alive" indicators on long runs. Not implemented; today the UI just
   shows last-event timestamp. Easy to add: publish a heartbeat event
   every N seconds during a long run.
10. **Metrics.** No Prometheus / OTel instrumentation. At minimum
    expose: `runs_in_flight`, `runs_completed_total`, `runs_failed_total`,
    `queue_depth`, `worker_loop_lag_ms`. Useful for autoscaling
    decisions later.
11. **Worker autoscaling strategy.** Today: one worker process. A
    surge of traffic queues up. Either:
    - run a fixed pool of N workers and tune `WORKER_CONCURRENCY`, or
    - autoscale on `queue_depth` (Fly Machines / k8s HPA).
12. **Resource limits.** No CPU/memory caps. A runaway tool could OOM
    the worker. Add cgroup limits via the host (Fly: `[[services]]
    ... [[machines]]`; k8s: `resources.limits`).

#### Local dev quality-of-life

13. **No watch mode.** `npm run worker` requires manual restart on
    code changes. Add:
    ```json
    "worker:watch": "tsx watch --env-file=.env.local src/worker/index.ts"
    ```
14. **No queue inspector UI.** Bull Board is one `<100 LoC` route
    away — useful for seeing job state during development.

#### Concrete first deploy

If you want the **shortest path** to a real worker in production:

1. `fly launch --no-deploy` from the repo root, choose a name, pick a
   region close to Neon + Redis.
2. Edit `fly.toml`:
   ```toml
   [build]
     dockerfile = "Dockerfile"
     build-target = "worker"

   [processes]
     worker = "npx tsx src/worker/index.ts"

   [[services]]
     internal_port = 8080         # for the health endpoint you'll add
     processes = ["worker"]
     [[services.tcp_checks]]
       interval = "10s"
       timeout = "2s"
   ```
3. `fly secrets set DATABASE_URL=... REDIS_URL=... PROVIDER_ENCRYPTION_KEY=... JWT_SECRET=... OPENROUTER_API_KEY=...`
4. Add the `/healthz` endpoint in `src/worker/index.ts` (one of the
   blockers above).
5. `fly deploy`.
6. On Vercel, set `REDIS_URL` to the same value. Now chat goes through
   the queue.

Total time once the blockers are addressed: ~30 minutes.

---

## Testing

```bash
npm test            # vitest run
npm run test:watch  # vitest watch
npm run typecheck   # tsc --noEmit (covers app + worker)
```

Suites in `tests/unit/`:

- `crypto.test.ts` — AES-256-GCM round-trip, random IV, tamper-detect, prefix.
- `plans.test.ts` — `planFor` fallback, tier ordering, UTC `currentPeriod`.
- `payload.test.ts` — string truncation, array truncation, small-value preservation.
- `webhook-signing.test.ts` — signature format and HMAC equivalence.

These are pure unit tests — they don't need a DB, Redis, or LLM. To
add **integration tests** (recommended, not yet built):

1. Spin Postgres in CI (services block in `ci.yml`).
2. Apply schema before tests, drop after.
3. Use `pg.Pool` directly to set up fixtures, then call services /
   handlers like the chat route would.

CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every
push to `main` and every PR. Build receives placeholder secrets so the
env validator passes — no real DB calls happen during build.

---

## Deployment

Pablo deploys as **two processes**:

1. **`web`** — the Next.js app. Vercel works perfectly; any Node host
   does too. Default port 3000.
2. **`worker`** — `tsx src/worker/index.ts`. Needs Redis. Skip if
   you're OK running everything inline (single-tab synchronous chat).

### Vercel + Upstash + Neon (typical stack)

1. **Neon**: create a project; copy the pooler URL with
   `?sslmode=require&channel_binding=require`. Set `DATABASE_URL`.
2. **Upstash Redis** (or any managed Redis): set `REDIS_URL`.
3. **Vercel**:
   - Import the repo.
   - Set env vars: `DATABASE_URL`, `JWT_SECRET`,
     `PROVIDER_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` (your Vercel
     domain), `OPENROUTER_API_KEY` (if you want auto-provisioned
     providers), `REDIS_URL`, plus Stripe vars when ready.
   - Build cmd: default. Output: default.
4. **Worker host** (Fly / Railway / Render / Fargate):
   - `docker build --target worker -t pablo-worker .`
   - Same env vars as Vercel, plus `WORKER_CONCURRENCY`.
   - Health-check by checking the BullMQ queue isn't stuck. There's no
     dedicated `/health` endpoint yet — add one if your host needs it.
5. **Schema**: run `npm run db:init` once against prod, locally, with
   the prod `DATABASE_URL` in env. Re-run when `schema.sql` changes
   (until we add a migration tool).
6. **Stripe**: register `https://<your-host>/api/billing/webhook` in
   the Stripe dashboard, copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.

### Single-host fallback

If you don't want a separate worker host, **don't** set `REDIS_URL`.
The chat endpoint runs inline. Closing the tab cancels the run. Fine
for solo / small workloads.

### Docker

```
docker build -t pablo-web .                    # Next.js server
docker build --target worker -t pablo-worker . # Worker
```

Both run as a non-root user (`pablo`). Web exposes 3000.

---

## Production gaps

Honest list, prioritised. See README's "production checklist" too.

### Hard blockers for first paying customer

1. **Secrets manager** — env files only today. Move to AWS Secrets
   Manager / Vault / Doppler before launch.
2. **Migration tool** — `db:init` is idempotent for additive changes
   only. Pick `drizzle-kit`, `node-pg-migrate`, or `goose`.
3. **Error tracking + log shipping + uptime monitoring** — Sentry +
   Loki / CloudWatch + Better Uptime is the easy stack.
4. **Backup recovery rehearsal** — restore a Neon snapshot to a scratch
   DB and confirm the app boots.
5. **Stripe live mode end-to-end** — register webhook URL, run a test
   purchase from staging.
6. **Health endpoint + readiness check** — `/api/health` returning DB +
   Redis ping. Trivial to add.

### Important

7. **S3 trace offload** — payloads >64 KB are truncated; offload to
   S3 with `payload_ref` URL in the row.
8. **OpenTelemetry** — instrument the run path so you can see which
   step is slow.
9. **CSP / HSTS / security headers** — defence-in-depth on top of the
   SameSite cookie.
10. **JSON Schema validation on agent output** — declared on the
    agent, not enforced.
11. **Webhook DLQ + replay UI** — failed deliveries currently just sit
    as `failed`.
12. **SSRF hardening on `http.request`** — DNS-rebinding lookup, egress
    allowlist, RFC1918 catch covers literals only.
13. **Email** — signup confirmation, password reset, quota
    notifications. None today.
14. **Team management** — invite teammates, roles. Not built; org
    creator is the only member.
15. **Full `/v1` API** — currently just agents/runs.

### Polish

16. Streaming with tool calls (final answer is one delta event today).
17. Anthropic streaming.
18. Integration tests for `/v1` + webhook delivery.
19. Versioned agent **config** (only prompts are versioned).
20. Public docs site + JS / Python SDK.
21. Cost calculator per provider/model (`cost_cents` is always 0).
22. CSRF token in addition to SameSite cookie.
23. `quota.threshold` event firing.

---

## Operations cookbook

### "I want to add a new built-in tool"

1. Write `backend/tools/<name>.tool.ts` implementing `Tool`.
2. Register in `backend/tools/registry.ts`.
3. Surface in `shared/constants/tools.ts` so the create-agent UI lists it.
4. Add unit tests for the `execute` happy path + edge cases.

### "I want to add a new LLM provider"

1. Add the type literal in `shared/types/provider.types.ts`.
2. Add the metadata entry in `shared/constants/providers.ts` (label,
   default base URL, key label, extra fields).
3. Write `backend/gateway/adapters/<name>.adapter.ts` — at minimum
   implement `LlmAdapter.call`. Add `stream` if the provider supports it.
4. Wire into `pickAdapter()` in `backend/gateway/index.ts`.
5. Update `provider.service.testProvider` if the model-list endpoint
   has a different shape.

### "I want to add a webhook event"

1. Add the literal to `WebhookEvent` + `ALL_EVENTS` in
   `backend/services/webhook.service.ts`.
2. Surface it in the UI (`RegisterWebhookForm`).
3. Call `dispatchEvent(orgId, "<your.event>", payload)` from wherever
   the trigger fires. Keep it fire-and-forget unless the caller can
   tolerate up to ~36s of retry.

### "I want to add a new `/v1` endpoint"

1. Implementation: `backend/api/v1/<path>/route.ts`. Always start with
   `const auth = await withV1Auth(req)`. Return RFC-7807 problems via
   `problem(status, code, detail, extra?)`.
2. Re-export: `app/api/v1/<path>/route.ts` — single-line export.
3. Add an integration test (when we have those).
4. Update this doc's `/v1` table.

### "I want to delete an agent for real" (hard delete)

There's no UI for it. Service code:

```sql
-- run as a transaction
DELETE FROM run_events
 WHERE run_id IN (SELECT id FROM runs WHERE agent_id = $1);
DELETE FROM runs            WHERE agent_id = $1;
DELETE FROM agent_memory    WHERE agent_id = $1;
DELETE FROM prompt_versions WHERE agent_id = $1;
DELETE FROM agents          WHERE id = $1 AND org_id = $2;
```

The dev guide says **don't** rewrite traces to clean up after an incident
(§11.4). Use this only for GDPR right-to-be-forgotten. Add a real endpoint
when needed.

### "I want to roll a leaked secret"

- `JWT_SECRET` rotation: change env, redeploy. **All sessions invalidate
  immediately**. Users have to log in again.
- `PROVIDER_ENCRYPTION_KEY` rotation: ⚠️ **breaks every encrypted
  provider key**. You'll need to re-encrypt all `providers.encrypted_key`
  values. Not built — write a one-off script if/when needed.
- Provider API keys (the user's own): UI flow at
  `/providers/<id>/edit`, paste new key, save. The old encrypted
  ciphertext is overwritten.
- API key rotation: revoke old + issue new at `/keys`.
- Webhook secret rotation: not built. Today: delete the webhook + register
  it again with the new secret on the receiving side.

### "I want to know what changed last deploy"

Production lacks a `/api/version` endpoint today. Add one returning
`{ git_sha: process.env.VERCEL_GIT_COMMIT_SHA }` or similar — easy
fix, valuable.

---

## Troubleshooting

### `Error: Cannot find module './138.js'` (or similar) on dev start

Stale `.next` chunk cache. `npm run clean && npm run dev`. Happens when
`next dev` and `next build` write into the same `.next` and chunk IDs
diverge.

### `getaddrinfo ENOTFOUND` for Neon host

Local DNS resolver is refusing the host. Try `nslookup <host> 8.8.8.8`
to confirm DNS works elsewhere; if so, your local resolver / VPN is
the culprit. Doesn't affect production.

### Build error about Edge runtime + jose `DecompressionStream`

Known and harmless. `jose` ships an Edge-compatible build that uses
`DecompressionStream`; Next.js warns but the middleware build still
succeeds. Don't change `jose`.

### `next-env.d.ts` shows up as untracked

It's gitignored. If you accidentally committed it, `git rm
--cached next-env.d.ts`.

### Tests fail with `DATABASE_URL is not set`

You imported a test file that pulls in a service that pulls in the DB
client. Either:
- mock the import, or
- extract the pure helper to `backend/utils/...` (see how
  `signWebhookBody` was lifted out of `webhook.service`).

### Worker exits immediately

Check `REDIS_URL` and `DATABASE_URL` — the worker bails fast if either
is unset.

### Chat in production hangs forever

Almost always: `REDIS_URL` is set on the web host but no worker is
running anywhere. Either start the worker process, or remove
`REDIS_URL` from the web host's env to fall back to inline mode.

---

## Conventions

- **No emojis in commits or code** unless the user explicitly asks.
  Commit messages are descriptive, no AI attribution.
- **Server actions** are deliberately not used. All mutations go through
  HTTP routes for symmetry between dashboard and `/v1`.
- **No `any` in TypeScript.** Use `unknown` + type narrowing, or a
  named type. Validators (zod) handle the boundary.
- **Repository functions return plain rows**, not class instances. Use
  shared types from `shared/types/`.
- **Error handling** at the API boundary uses RFC-7807 problem+json.
  Service-layer errors are typed (named subclasses of `Error` with a
  `code` field). Don't swallow; rethrow as a typed error or let it
  propagate.
- **Comments**: only the *why*. Don't restate the *what* — names should
  do that.

---

## What's intentionally not built

Per the developer guide §2.2 and updated for reality:

- Visual no-code builders.
- Agent marketplace (no public registry of agents).
- General-purpose chatbot UX (Pablo's chat is the operations surface for
  *your* agents, not a consumer product).
- Auto-prompt engineering.
- Fully autonomous self-modifying agents.
- Legacy-API compatibility shims. The `/v1` surface is the contract;
  changes are versioned with a new `/v2` if needed.

---

## How to contribute

1. **Read this doc end-to-end.** It's the working contract.
2. **Pick a Phase-9 gap** from [Production gaps](#production-gaps) or a
   "wanted" item from the README's checklist.
3. **Branch off `main`**, work in small commits, follow the conventions.
4. **Tests first** for anything in services / utils / repositories. UI
   can lag behind unit coverage.
5. **Update this doc** in the same PR if your change affects how
   anything in here works.
6. **Open the PR**. CI runs typecheck + tests + build.

The shortest critical path to production: pick the **first three hard
blockers**. A weekend of focused work each. Then we can ship to a
paying customer.

---

*Last updated: as of commit `adaa9df`. Behaviour described here is
exactly what the code does. If you find a discrepancy, the code wins
and this file gets a PR.*
