---
title: "AI Agents Platform — Developer Guide"
subtitle: "A Programmable Platform for Long-Running, Tool-Enabled, Cost-Bounded Agents"
author: "Ten Sparrows — Engineering"
date: "2026-04-23"
---

# AI Agents Platform — Developer Guide

> **Purpose.** This document is a developer's guide to the AI Agents Platform. It is not a statement of work. It describes what we are building, how it is structured, the feature list, the technology stack, the public API surface, the internal routes, and the data/architecture diagrams developers should hold in their heads when contributing code.
>
> **Audience.** Engineers joining the project, integrators building against the platform API, and operators running the execution fabric.

---

## 1. Product Summary

The AI Agents Platform is a **programmable agent execution platform**. Users sign up, pay via Stripe, and create one or more **agents** — long-running, tool-enabled, resource-bounded programs that run on **Ten Sparrows micro data centers (MDCs)**.

Our positioning is explicit:

- **Not** a chatbot wrapper.
- **Not** a visual no-code builder.
- **Not** an agent marketplace.
- **Not** a general-purpose consumer UX.

We make AI **operational**: predictable cost, clear execution, debuggable behavior, and strong separation between the control plane and the execution plane.

### 1.1 Conceptual Model

```
 ┌────────┐        ┌────────┐        ┌─────────┐
 │  Brain │  ───▶  │ Agent  │  ───▶  │  Skill  │
 └────────┘        └────────┘        └─────────┘
  (LLM core)       (TS EdgeNest       (callable
                    runtime)           tool / capability)
```

- **Brain** — the LLM layer (OpenRouter, model `minimax/minimax-m2.5:free` initially).
- **Agent** — a user-authored configuration (goal, prompt, tool allowlist, limits). Executed by **TS EdgeNest**, our TypeScript-based agent runtime.
- **Skill** — a tool the agent can invoke. Skills are internal, sandboxed, and registered centrally (no marketplace).

### 1.2 Target Users

Initial users are technical: founders, platform engineers, automation teams, and developers building internal tools or AI workflows. They care about **control, reliability, cost predictability, and transparency** — not polish.

### 1.3 Product Principles (Decision Rules)

1. **Autonomy requires guardrails** — controlled autonomy over unrestricted freedom.
2. **Boring infrastructure beats clever systems** — reliability > novelty.
3. **Users pay for outcomes, not magic** — predictable costs, clear execution, measurable results.
4. **Debuggability is a feature** — users see what happened, understand why, and fix it without support tickets.
5. **Edge compute is a strategic advantage** — MDCs give us latency, isolation, and cost control.
6. **Start narrow, expand deliberately** — fewer powerful primitives over many shallow features.

**Tradeoff priority, when in doubt:** Reliability → Understandability → Cost Control → Speed of Iteration. Not feature count.

---

## 2. Scope

### 2.1 In Scope (MVP → Early Growth)

- User signup & Stripe billing
- Agent creation and configuration
- Tool-enabled agents
- Asynchronous execution
- Logs, outputs, and basic observability
- Hard resource limits and quotas
- Single or limited regions

### 2.2 Explicit Non-Goals (For Now)

- Visual no-code builders
- Agent marketplaces
- Consumer-friendly UX
- Auto-prompt engineering
- General-purpose chatbot replacement
- Fully autonomous self-modifying agents

### 2.3 Intentionally Flexible

The following will change as we learn, and should **not** be over-designed upfront:

- Agent abstraction details
- Execution granularity
- Memory implementation strategies
- Tool packaging format

---

## 3. Feature List

The platform is organized into nine functional areas. Every feature below is part of the initial build; items flagged *(future-proof)* have lightweight placeholders in MVP but are designed so the abstraction does not have to be retrofitted.

### 3.1 Core System — LLM Integration (OpenRouter-first)

| # | Feature | Notes |
|---|---------|-------|
| 1 | **LLM Gateway Layer** (mandatory abstraction) | Centralized wrapper for OpenRouter. Request shaping for `system` / `user` / `tool` messages; `temperature`, `max_tokens`, `stop`. Response normalization across providers. Retry + fallback handling even with a single model. |
| 2 | **Model binding** | `minimax/minimax-m2.5:free` at launch; model name stored per agent config. |
| 3 | **Cost & Usage Control** | Token usage tracked per agent / user / organization. Hard caps: max tokens per execution, max requests per minute / hour. Budget enforcement halts execution on breach. Cost estimation layer (0-cost-today, priced-tomorrow). |

### 3.2 Agent System (Core Product)

| # | Feature | Notes |
|---|---------|-------|
| 4 | **Agent Definition Engine** | Agent config: name, description, goal/task, input JSON schema. |
| 5 | **Execution Modes** | `one-shot`, `multi-step-loop`, `event-triggered`. |
| 6 | **Prompt Execution Framework** | Structured templates: system prompt, task prompt, tool instructions. **Versioned** prompts. Deterministic mode (temperature pinned low). |

### 3.3 Tooling System (Agent Capabilities)

| # | Feature | Notes |
|---|---------|-------|
| 7 | **Tool Abstraction Layer** | Every tool declares a `name`, input schema, output schema. Execution sandbox per tool. |
| 8 | **Tool Registry** | Internal only — no marketplace. |
| 9 | **Built-in Tools (MVP)** | `http.request`, `webhook.trigger`, `json.transform`, `memory.read`, `memory.write`. |

### 3.4 Execution Engine (Primary Differentiator)

| # | Feature | Notes |
|---|---------|-------|
| 10 | **Asynchronous Job System** | Queue-based. Status states: `queued`, `running`, `completed`, `failed`. Retry policy: exponential backoff + max retries. |
| 11 | **Multi-step Agent Loop** | Iterative reasoning (LLM → Tool → LLM → Tool). **Step limit** enforcement prevents runaway loops. **Timeout** enforcement. |

### 3.5 Observability (This Is the Product)

| # | Feature | Notes |
|---|---------|-------|
| 12 | **Execution Logs** | Full trace per run: prompts sent, responses received, tools invoked. Timestamped steps. |
| 13 | **Debugging Interface** | Replay execution. Step-by-step breakdown (why a tool was called, what input was used). Error surface: LLM failure, tool failure, timeout. |

### 3.6 Memory System (Controlled, Not Magic)

| # | Feature | Notes |
|---|---------|-------|
| 14 | **Scoped Memory** | Two scopes: per-execution (ephemeral) and per-agent (persistent). |
| 15 | **Storage** | JSON blobs. Explicit retrieval only — **no hidden vector DB** in MVP. |

### 3.7 User & Billing System

| # | Feature | Notes |
|---|---------|-------|
| 16 | **Authentication** | Email/password. OAuth as an optional early add. |
| 17 | **Billing (Stripe)** | Subscription tiers; execution limits; token quotas. Usage-based alerts. |

### 3.8 Infrastructure & Execution Fabric

| # | Feature | Notes |
|---|---------|-------|
| 18 | **Control Plane vs Execution Plane** | Control plane holds agent config + user data. Execution plane runs agents in isolated environments. |
| 19 | **Edge Execution Readiness** | Designed for distributed compute nodes and low-latency execution, even if initially centralized. |

### 3.9 Safety, Limits & API

| # | Feature | Notes |
|---|---------|-------|
| 20 | **Resource Limits** | Max steps per agent run; max runtime duration; max tool calls. |
| 21 | **Output Constraints** | JSON Schema validation for outputs; **fail execution if invalid**. |
| 22 | **Kill Switch** | Manual termination of running agents; auto-kill on abnormal behavior. |
| 23 | **Public API (MVP-Ready)** | Create agent, run agent, fetch logs, fetch results. |
| 24 | **Webhook Support** | Event triggers: `execution.completed`, `execution.failed`. |
| 25 | **Minimal UI** | Agent creation form, execution logs viewer. No drag-drop builders. |

---

## 4. Tech Stack

Choices reflect the principles above: boring, reliable, easy to operate, easy to debug.

### 4.1 Canonical Stack

| Layer | Choice | Why |
|---|---|---|
| **Agent Runtime (TS EdgeNest)** | Node.js 20 + TypeScript | LLM/tool code is easier to iterate on in TS. TS EdgeNest is the internal name for the agent runtime container. |
| **LLM Provider** | OpenRouter — `minimax/minimax-m2.5:free` | Single provider surface, model-agnostic abstraction. |
| **Control Plane API** | Node.js 20 + TypeScript + Fastify | Small, fast, strict schemas (Ajv/Zod). |
| **Minimal UI** | Next.js 14 (App Router) + Tailwind | Server components, no visual builder, kept deliberately thin. |
| **Primary DB** | PostgreSQL 16 | Users, agents, runs, prompts, billing state. |
| **Queue + Ephemeral State** | Redis 7 (Streams / BullMQ) | Async job queue, run status, rate-limit counters. |
| **Object Store** | S3-compatible (MinIO locally; S3 in prod) | Execution traces, large logs, outputs. |
| **Auth** | Email/password (Argon2id) + OAuth 2.1 providers | JWT access tokens; refresh tokens in httpOnly cookies for the UI. |
| **Billing** | Stripe (Subscriptions + Usage Records) | Stripe webhooks drive quota/subscription state. |
| **Schema / Validation** | JSON Schema (Ajv) + Zod at the TS boundary | Input/output schema per agent and per tool. |
| **Observability** | OpenTelemetry → ClickHouse / Grafana + Loki for logs | Structured trace per agent run. |
| **Containers** | Docker + a minimal orchestrator (MDC agent) | Workers scale horizontally on MDCs. |
| **CI/CD** | GitHub Actions | Lint, type-check, unit + integration tests, image build, canary deploy. |
| **IaC** | Terraform | Control plane + each MDC region. |
| **Languages at the edge** | TypeScript primary; Rust reserved for hot paths if needed | Keep surface area small; prefer TS until measured otherwise. |

### 4.2 Repository Layout (monorepo)

```
/apps
  /api            Fastify control-plane API
  /web            Next.js minimal UI
  /worker         TS EdgeNest agent runtime (job worker)
/packages
  /llm-gateway    OpenRouter client + request/response normalization
  /tools          Built-in tool implementations + registry
  /schemas        Shared JSON Schema + Zod types
  /sdk-js         Public TypeScript SDK (thin wrapper over REST)
  /observability  Trace, log, metric helpers
  /billing        Stripe integration helpers
/infra
  /terraform      Control plane + MDC region modules
  /docker         Dockerfiles, compose for local dev
```

---

## 5. Architecture

High-level architecture, with six horizontal bands: Client → Control Plane → Execution Plane → Data & State → External → Observability & Guardrails.

![System Architecture](architecture.jpeg)

### 5.1 Control Plane Responsibilities

- Authenticate users and issue tokens.
- Store and version agent configurations and prompts.
- Meter usage and enforce quotas / budgets **before** enqueueing work.
- Enqueue runs onto the job queue.
- Surface run status, logs, and results back to the caller.
- Dispatch outbound webhooks on terminal state.
- Fire the kill switch when an operator or automated rule requests it.

### 5.2 Execution Plane Responsibilities

- Pull jobs off the queue.
- Hydrate the agent runtime with config, prompt version, scoped memory.
- Run the multi-step loop inside isolated sandboxes.
- Call the LLM Gateway and the allowed tools.
- Enforce step/runtime/tool-call limits.
- Emit a full trace back to the control plane / object store.

### 5.3 Control Plane ↔ Execution Plane Contract

The only things that cross the boundary are:

1. **`EnqueueRun`** — `{ run_id, agent_cfg_snapshot, prompt_version, input, limits }` onto a queue.
2. **`RunEvents`** — heartbeat, step events, terminal status — onto a return topic.
3. **`TraceBlob`** — large trace objects written directly to the object store by the worker, referenced by URL in run events.

We deliberately snapshot `agent_cfg` and `prompt_version` at enqueue time so editing a live agent **does not** mutate a running execution.

---

## 6. Data Flow

This sequence describes one agent run end-to-end, from API call to webhook.

![Agent Execution Data Flow](dataflow.jpeg)

### 6.1 Run Lifecycle (Narrative)

1. A client calls `POST /v1/agents/{id}/runs` with a JSON input.
2. The control plane authenticates, validates the input against the agent's input schema, and checks quota + budget.
3. On pass, it enqueues the run (`run_id` + a snapshot of the agent config + prompt version) onto the job queue.
4. The API responds `202 Accepted` with `{ run_id, status: "queued" }`.
5. A worker on an MDC pulls the job.
6. The worker loads the agent config, the pinned prompt version, and any scoped memory.
7. **Agent loop begins.** The worker calls the LLM Gateway with the system prompt, the task prompt, the tool specifications, and conversation state.
8. The LLM returns either a **tool call** or a **final message**.
9. If a tool call, the worker validates the tool's input schema and invokes the tool inside its sandbox.
10. The tool returns output, which is validated against the tool's output schema.
11. The worker appends the step to the run's trace and checks step / runtime / tool-call limits.
12. The worker decides to continue looping or to finalize.
13. On terminal state, the worker persists the final output, usage counters, and trace pointer.
14. The control plane updates the run record, updates quota counters, and emits the webhook.
15. The webhook (`execution.completed` or `execution.failed`) is delivered to the registered consumer.
16. The client may at any point `GET /v1/runs/{id}` to retrieve status, result, and logs.

### 6.2 Failure & Kill Paths

- **LLM failure** → retry inside the Gateway per policy; if exhausted, fail the step → fail the run.
- **Tool failure** → same retry / surface pattern; the trace records attempts.
- **Step limit** / **timeout** / **tool-call limit** exceeded → run marked `failed` with reason code; webhook fires.
- **Kill switch** (manual or auto) → worker receives a cancel signal on the next step boundary; partial trace is preserved.
- **Budget exceeded** (tokens or $) → run is halted at the next step; `reason = "budget_exceeded"`.

### 6.3 State Transitions

```
  [queued] ──▶ [running] ──┬──▶ [completed]
                           ├──▶ [failed]
                           └──▶ [cancelled]   (kill switch)
```

Transitions are append-only in Postgres, so the full history of a run is always reconstructable.

---

## 7. Public API

All endpoints are JSON over HTTPS, versioned under `/v1`. Authentication is `Authorization: Bearer <access_token>` for API clients (OAuth 2.1 style PATs in MVP). UI sessions use httpOnly cookies.

**Conventions**

- Resource IDs are opaque strings: `agent_...`, `run_...`, `key_...`, `wh_...`.
- Timestamps are RFC 3339 in UTC.
- Errors follow RFC 7807 (`application/problem+json`) with a machine `code` field.
- Write endpoints accept an `Idempotency-Key` header; replays within 24h return the original response.
- Pagination is cursor-based (`?cursor=`, `?limit=`).

### 7.1 Authentication & Users

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/auth/signup` | Create user. |
| `POST` | `/v1/auth/login` | Exchange email/password for tokens. |
| `POST` | `/v1/auth/refresh` | Rotate refresh token. |
| `POST` | `/v1/auth/logout` | Revoke refresh token. |
| `GET`  | `/v1/me` | Current user + org. |
| `GET`  | `/v1/orgs/{org_id}/members` | List org members. |

### 7.2 API Keys

| Method | Path | Purpose |
|---|---|---|
| `POST`   | `/v1/keys` | Issue an API key. Plaintext returned **once**. |
| `GET`    | `/v1/keys` | List keys (metadata only). |
| `DELETE` | `/v1/keys/{key_id}` | Revoke a key. |

### 7.3 Agents

| Method | Path | Purpose |
|---|---|---|
| `POST`   | `/v1/agents` | Create an agent. |
| `GET`    | `/v1/agents` | List agents. |
| `GET`    | `/v1/agents/{agent_id}` | Fetch agent. |
| `PATCH`  | `/v1/agents/{agent_id}` | Update (mutates future runs only). |
| `DELETE` | `/v1/agents/{agent_id}` | Archive agent (soft delete). |
| `POST`   | `/v1/agents/{agent_id}/prompts` | Publish a new prompt version. |
| `GET`    | `/v1/agents/{agent_id}/prompts` | List prompt versions. |

**Example — create agent**

```http
POST /v1/agents
Authorization: Bearer sk_live_...
Content-Type: application/json
Idempotency-Key: 01HS-...

{
  "name": "daily-sales-digest",
  "description": "Summarises yesterday's sales from the CRM.",
  "execution_mode": "one_shot",
  "model": "minimax/minimax-m2.5:free",
  "system_prompt_id": "prm_v1",
  "input_schema":  { "type": "object", "required": ["date"], "properties": { "date": {"type": "string", "format": "date"} } },
  "output_schema": { "type": "object", "required": ["summary"], "properties": { "summary": {"type": "string"} } },
  "tools": ["http.request", "json.transform"],
  "limits": {
    "max_steps": 12,
    "max_runtime_ms": 60000,
    "max_tool_calls": 20,
    "max_tokens_per_run": 40000
  }
}
```

### 7.4 Runs (Executions)

| Method | Path | Purpose |
|---|---|---|
| `POST`   | `/v1/agents/{agent_id}/runs` | Start a run. Returns `202` + `run_id`. |
| `GET`    | `/v1/runs/{run_id}` | Fetch run state + result. |
| `GET`    | `/v1/runs/{run_id}/logs` | Structured log stream (JSON lines). |
| `GET`    | `/v1/runs/{run_id}/trace` | Step-by-step trace for the debugger. |
| `POST`   | `/v1/runs/{run_id}/cancel` | Kill switch for this run. |
| `POST`   | `/v1/runs/{run_id}/replay` | Create a new run replaying the same input (new `run_id`). |
| `GET`    | `/v1/runs` | List runs (filter by agent, status, time). |

**Example — start a run**

```http
POST /v1/agents/agent_01HS.../runs
Content-Type: application/json

{ "input": { "date": "2026-04-22" } }
```

```http
HTTP/1.1 202 Accepted
{
  "run_id":  "run_01HS...",
  "status":  "queued",
  "agent_id":"agent_01HS...",
  "queued_at":"2026-04-23T10:15:00Z"
}
```

### 7.5 Tools (Read-only in MVP)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/tools` | List registered tools available to your org. |
| `GET` | `/v1/tools/{name}` | Get tool metadata + input/output schema. |

Built-in tools in MVP: `http.request`, `webhook.trigger`, `json.transform`, `memory.read`, `memory.write`.

### 7.6 Memory

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/v1/agents/{agent_id}/memory` | Read persistent (agent-scoped) memory. |
| `PUT`    | `/v1/agents/{agent_id}/memory` | Write persistent memory. |
| `DELETE` | `/v1/agents/{agent_id}/memory/{key}` | Delete key. |

Execution-scoped memory is not exposed over the public API — it lives and dies with the run.

### 7.7 Webhooks

| Method | Path | Purpose |
|---|---|---|
| `POST`   | `/v1/webhooks` | Register a webhook endpoint + event filter. |
| `GET`    | `/v1/webhooks` | List webhooks. |
| `DELETE` | `/v1/webhooks/{wh_id}` | Remove webhook. |
| `POST`   | `/v1/webhooks/{wh_id}/test` | Fire a synthetic event. |

Events delivered: `execution.completed`, `execution.failed`, `execution.cancelled`, `quota.threshold`, `subscription.updated`.

Every webhook request is signed: `X-Pablo-Signature: t=<ts>,v1=<hmac_sha256>`.

### 7.8 Billing

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/v1/billing/subscription` | Current plan, limits, usage. |
| `POST` | `/v1/billing/portal` | Create a Stripe billing portal session. |
| `POST` | `/v1/billing/checkout` | Create a Stripe checkout session (upgrade/downgrade). |
| `POST` | `/v1/billing/webhook/stripe` | Inbound from Stripe (signature-verified, server-to-server). |

### 7.9 Usage & Quotas

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/usage` | Aggregate tokens / runs / cost — by day, agent, user. |
| `GET` | `/v1/quotas` | Current quota ceilings and remaining. |

### 7.10 Error Shape

```json
{
  "type":   "https://docs.pablo.ai/errors/quota-exceeded",
  "title":  "Quota exceeded",
  "status": 429,
  "code":   "quota_exceeded",
  "detail": "Monthly token quota of 2,000,000 was exceeded.",
  "instance": "run_01HS..."
}
```

---

## 8. Internal Routes (Control Plane ↔ Execution Plane)

These are **not** public. They exist between services inside Ten Sparrows infrastructure, typically behind mTLS and service auth.

### 8.1 Queue Topics (Redis Streams / BullMQ)

| Topic | Direction | Payload |
|---|---|---|
| `runs.enqueue`      | Control → Workers | `{ run_id, agent_cfg_snapshot, prompt_version, input, limits, quota_token }` |
| `runs.events`       | Workers → Control | `{ run_id, type, step, ts, payload }` where `type ∈ {started, step, tool_call, tool_result, llm_call, llm_result, failed, completed, cancelled}` |
| `runs.heartbeat`    | Workers → Control | `{ run_id, worker_id, ts, step }` — liveness signal. |
| `runs.cancel`       | Control → Workers | `{ run_id, reason }` — kill switch. |

### 8.2 Internal HTTP (service-to-service)

| Method | Path | Called by | Purpose |
|---|---|---|---|
| `POST` | `/internal/traces`       | Worker → Control | Final trace pointer + usage counters. |
| `POST` | `/internal/usage/commit` | Worker → Control | Commit token/cost usage against the quota token. |
| `POST` | `/internal/webhooks/dispatch` | Control → Dispatcher | Enqueue webhook delivery with retry. |
| `GET`  | `/internal/agents/{id}/snapshot` | Worker → Control | Fetch immutable agent snapshot for a run. |
| `POST` | `/internal/alerts`       | Any → Alerting | Emit structured alert (quota threshold, abnormal behaviour). |

### 8.3 Object Store Paths

```
s3://pablo-traces/{org_id}/{agent_id}/{run_id}/trace.json
s3://pablo-traces/{org_id}/{agent_id}/{run_id}/steps/{step}.json
s3://pablo-outputs/{org_id}/{agent_id}/{run_id}/output.json
```

### 8.4 Minimal UI Routes (Next.js)

| Path | Purpose |
|---|---|
| `/login`, `/signup` | Auth screens. |
| `/agents` | List and create agents. |
| `/agents/[id]` | Agent overview + recent runs. |
| `/agents/[id]/edit` | Config + prompt editor (versioned). |
| `/agents/[id]/runs/[run_id]` | Run detail, logs, step-by-step replay. |
| `/usage` | Tokens, runs, cost, quota. |
| `/billing` | Plan, invoices, Stripe portal entry. |
| `/keys` | API keys. |
| `/webhooks` | Webhook management. |

Deliberately omitted: drag-drop builders, canvas editors, "AI writes your agent for you" UX.

---

## 9. Data Model (Core Tables)

Simplified — columns trimmed to what drives behavior.

```
users              (id, email, password_hash, created_at)
orgs               (id, name, owner_user_id, plan, created_at)
org_members        (org_id, user_id, role)
api_keys           (id, org_id, name, prefix, hash, last_used_at, revoked_at)

agents             (id, org_id, name, description, execution_mode, model,
                    current_prompt_version, input_schema, output_schema,
                    tools_allowlist, limits_json, archived_at, created_at)

prompt_versions    (id, agent_id, version, system_prompt, task_prompt,
                    tool_instructions, created_by, created_at)

runs               (id, org_id, agent_id, agent_snapshot_id, prompt_version_id,
                    status, reason_code, input, output, tokens_in, tokens_out,
                    cost_cents, step_count, tool_call_count,
                    queued_at, started_at, finished_at)

run_events         (run_id, seq, ts, type, payload_ref)   -- append-only

agent_memory       (agent_id, key, value_json, updated_at)

quotas             (org_id, period, tokens_limit, tokens_used,
                    runs_limit, runs_used, cost_cents_limit, cost_cents_used)

subscriptions      (org_id, stripe_customer_id, stripe_sub_id, plan, status,
                    current_period_end)

webhooks           (id, org_id, url, secret, event_filter, created_at, disabled_at)
webhook_deliveries (id, webhook_id, event, payload_ref, status, attempt,
                    last_attempt_at, next_attempt_at)
```

Two invariants worth calling out:

- **`runs.agent_snapshot_id`** references an immutable copy of the agent config at enqueue time.
- **`run_events` is append-only.** No updates, no deletes — this is what makes the debugger honest.

---

## 10. Security & Guardrails

### 10.1 Authentication & Authorization

- Passwords: Argon2id, per-user salt.
- JWT access tokens (15 min); refresh tokens (30 days, rotating, httpOnly cookie for the UI).
- API keys are random 32-byte tokens with a public prefix (`sk_live_`) and a SHA-256 hash stored in DB. Plaintext shown exactly once.
- Every request is scoped to an org; cross-org access is never allowed in the API layer.

### 10.2 Sandboxing

- Each tool executes in an isolated process/container on the worker.
- No ambient credentials — tools receive only the inputs the agent config explicitly allows.
- Outbound egress from tools is allow-listed per tool category.

### 10.3 Secrets

- Stripe / OpenRouter / worker tokens live in a secrets manager (AWS Secrets Manager / Vault).
- No secrets in environment files committed to Git.

### 10.4 Guardrails at Runtime

- Hard caps: `max_steps`, `max_runtime_ms`, `max_tool_calls`, `max_tokens_per_run`.
- JSON Schema validation on every tool input, every tool output, and the agent's final output.
- Kill switch: manual cancel endpoint + automatic cancellation on abnormal signals (runaway loops, repeated identical tool calls, heartbeat loss, budget exceeded).

### 10.5 Observability (Non-optional)

- Every run has a **full trace**: prompts sent, responses received, tools invoked, timestamps.
- Traces are retained per org retention policy and surfaced through the replay/debugger UI.
- Metrics: `runs_total`, `runs_failed_total`, `llm_tokens_total`, `tool_latency_ms`, `queue_depth`.

---

## 11. Operational Model

### 11.1 Environments

- **local** — Docker Compose: Postgres, Redis, MinIO, API, Worker, Next.js.
- **staging** — single MDC region; shadow traffic from production where safe.
- **production** — control plane in a primary region; workers on one or more MDCs.

### 11.2 Deployment

- GitHub Actions build and push OCI images.
- Terraform applies infra changes.
- Workers are rolled with `drain → replace` (queue-aware): a worker finishes its current step, publishes state, and exits cleanly.

### 11.3 Monitoring & Alerts

- **SLOs**: run enqueue latency (P99 < 300ms), run success rate (≥ 99% excluding user-caused failures), webhook delivery success rate (≥ 99.5%).
- **Alerts**: quota threshold breaches, abnormal run behavior, worker heartbeat loss, Stripe webhook failures.

### 11.4 Incident Principles

- Run history is append-only; never rewrite a trace to "clean up" after an incident.
- Prefer a cancel + re-run over ad-hoc patches on a live run.
- Post-incident, update the relevant guardrail, not just the symptom.

---

## 12. Extension Path (Not MVP, but Compatible)

These are **intentionally not built** now but the abstractions above should not have to be rewritten to add them.

- Additional LLM providers (behind the LLM Gateway).
- Richer memory strategies (e.g., vector recall) as an **explicit** tool, not hidden middleware.
- Multi-region scheduling with per-region data residency.
- Scheduled / cron triggers (already accommodated by `event-triggered` mode).
- A public tool registry — deferred until primitives prove stable.

---

## 13. What Success Looks Like

- Users trust agents to run unattended.
- Costs never surprise users.
- Debugging is straightforward.
- Scaling agents is boring — in a good way.

If a proposed feature does not serve one of those four statements, it does not belong in MVP.

---

## Appendix A — Glossary

- **Agent** — A user-authored configuration executed by TS EdgeNest. Composed of a goal, a prompt version, an input schema, an output schema, a tool allowlist, and hard limits.
- **Brain** — The LLM layer, abstracted behind the LLM Gateway.
- **Skill / Tool** — A sandboxed, schema-bound capability the agent may invoke.
- **Run** — A single execution of an agent against a single input.
- **Trace** — The append-only, step-by-step record of a run.
- **Control Plane** — Orchestration, config, billing, quotas.
- **Execution Plane** — The workers on Ten Sparrows MDCs that actually run agents.
- **MDC** — Micro Data Center. Our edge execution fabric.
- **Quota Token** — A short-lived authorization issued by the control plane that permits a worker to consume a bounded amount of tokens / cost for a specific run.

## Appendix B — Reference Competitors

The closest reference points, listed for orientation (not as templates to copy):

- **Hostinger OpenClaw** — comparable agent-ish offering; meaningful manual setup required. Reference: [YouTube walkthrough](https://www.youtube.com/watch?v=dPoIuIvOPo8).
- **Base44** — adjacent developer-agent space.

Our differentiator versus both is **automation of setup + orchestration**, enforced resource limits, and execution on our own fabric.
