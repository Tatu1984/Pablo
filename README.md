# Pablo — AI Agents Platform

Programmable, tool-enabled, cost-bounded agents.

- **[`ENGINEERING_HANDBOOK.md`](ENGINEERING_HANDBOOK.md)** — what's built, where
  to find it, how to run it, how to extend it, what's left for production.
  Read this first.
- [`Developer_Guide.md`](Developer_Guide.md) — original product / design doc.
  Aspirational; some parts are not built yet (see the handbook for the as-built
  state).

## Quick start

```bash
# 1. install
npm ci

# 2. environment — copy the template and fill in secrets
cp .env.example .env.local
# generate three required secrets:
echo "JWT_SECRET=$(openssl rand -base64 32)"             >> .env.local
echo "PROVIDER_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
# add your OPENROUTER_API_KEY (or skip; users can add per-org via UI)

# 3. database — Neon Postgres URL goes into DATABASE_URL
npm run db:init                # idempotent; safe to re-run

# 4. dev server
npm run dev                    # http://localhost:3000
```

Demo login: `demo@pablo.ai` / `demo`. Or hit `/register` for a fresh org.

## Background worker (Phase 5)

Set `REDIS_URL` and run a separate worker process; runs survive tab close.

```bash
docker compose up -d redis     # local Redis
# uncomment REDIS_URL in .env.local
npm run worker                 # in one terminal
npm run dev                    # in another
```

Without `REDIS_URL` the chat endpoint executes runs in-process — fine for dev, not for prod.

## Public API (Phase 8)

```bash
# 1. issue a key from /keys (UI), or via the dashboard API:
curl -b cookies.txt -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" -d '{"name":"prod"}'
# response: { key, plaintext: "sk_live_..." }

# 2. use it
curl https://your.domain/v1/agents \
  -H "Authorization: Bearer sk_live_..."
```

Surface so far:

| Endpoint                              | Method | Purpose                          |
| ------------------------------------- | ------ | -------------------------------- |
| `/v1/agents`                          | GET    | list active agents               |
| `/v1/agents/{id}`                     | GET    | fetch one                        |
| `/v1/agents/{id}/runs`                | POST   | start a run; returns 202 + result |
| `/v1/agents/{id}/runs`                | GET    | list runs for the agent           |
| `/v1/runs/{id}`                       | GET    | run + full trace                  |
| `/v1/runs/{id}/cancel`                | POST   | cooperative cancel                |

Errors are RFC-7807 `application/problem+json` with a typed `code` field.

## Webhooks (Phase 8)

Register an HTTPS endpoint from `/webhooks` (UI) or via `POST /api/webhooks`. Each webhook gets its own signing secret.

Every delivery is signed:
```
X-Pablo-Signature: t=<unix>,v1=<hex hmac-sha256 of `${ts}.${body}`>
```

Events fired:

- `execution.completed`
- `execution.failed`
- `execution.cancelled`
- `quota.threshold` *(coming)*
- `subscription.updated` *(coming)*

Retries: up to 4 attempts at delays `[0, 1s, 5s, 30s]`. The `webhook_deliveries` table is the audit trail.

## Billing & quotas (Phase 7)

- Plan tiers in `src/shared/constants/plans.ts` (Starter free / Pro $29 / Enterprise).
- Quotas enforced *before* `runs.enqueue` (developer guide §3.1) — runs/tokens/cost per UTC month.
- Stripe wired: checkout, customer portal, webhook receiver. Set `STRIPE_SECRET_KEY` + `STRIPE_PRICE_PRO` + `STRIPE_WEBHOOK_SECRET` to enable.

## Tests + CI

```bash
npm test            # vitest
npm run typecheck   # tsc --noEmit (worker + app)
npm run build       # next build
```

CI runs all three on every push. See `.github/workflows/ci.yml`.

## Docker

```bash
docker build -t pablo-web .
docker build --target worker -t pablo-worker .
```

`docker-compose.yml` brings up Redis for local dev.

## Production checklist

- [x] HTTPS everywhere — Pablo never reads plaintext keys from disk except via env
- [x] BYO LLM provider keys encrypted at rest (AES-256-GCM with `PROVIDER_ENCRYPTION_KEY`)
- [x] API keys hashed at rest (SHA-256), plaintext shown once
- [x] JWT-signed sessions with httpOnly cookies, edge-runtime middleware gate
- [x] Rate limiting on auth + chat + `/v1/runs` (Redis-backed if `REDIS_URL` set, in-memory fallback)
- [x] Quota enforcement before run start
- [x] Append-only run trace
- [ ] S3 trace offload (Phase 9 — currently full payloads in JSONB)
- [ ] OpenTelemetry / structured log shipping (Phase 9)
- [ ] Multi-region scheduling (Phase 9)
- [ ] Independent worker auto-scaling (Phase 9)

## Repository layout

```
src/
  app/                      Next.js App Router
    (auth)/{login,register} unauthenticated screens
    (dashboard)/            cookie-gated screens
    api/                    thin re-exports → backend handlers
  backend/
    api/                    actual route logic ({auth,agents,providers,
                            runs,billing,keys,webhooks,v1}/.../route.ts)
    services/               auth, run, runner, quota, stripe, webhook…
    repositories/           pure SQL access
    gateway/                LLM Gateway (OpenAI-compatible + Anthropic adapters)
    queue/                  Redis + BullMQ
    tools/                  built-in tool implementations
    database/               schema.sql, seed.mjs, pg client
    utils/                  hash, jwt, crypto, payload, rate-limit, sign
    validators/             zod schemas
  frontend/
    components/{ui,layout,features}
  shared/
    types/                  agent, provider, run, user
    constants/              tools, providers, plans
  worker/                   BullMQ runner process
  middleware.ts             Edge-runtime auth gate
tests/unit/                 vitest unit tests
```
