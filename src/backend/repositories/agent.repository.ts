import { query } from "@/backend/database/client";
import type { Agent, AgentLimits, ExecutionMode, Skill } from "@/shared/types/agent.types";

export async function getAgents(orgId: string): Promise<Agent[]> {
  return query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE org_id = $1 AND archived_at IS NULL
      ORDER BY created_at ASC`,
    [orgId],
  );
}

export async function getAgent(orgId: string, id: string): Promise<Agent | null> {
  const rows = await query<Agent>(
    `SELECT id, name, role, description, execution_mode, provider_id, model,
            current_prompt_version, tools, limits, intro, skills,
            to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
            to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM agents
      WHERE id = $1 AND org_id = $2 AND archived_at IS NULL`,
    [id, orgId],
  );
  return rows[0] ?? null;
}

export interface InsertAgentInput {
  id: string;
  orgId: string;
  name: string;
  role: string;
  description: string;
  executionMode: ExecutionMode;
  providerId: string;
  model: string;
  currentPromptVersion: string;
  tools: string[];
  limits: AgentLimits;
  intro: string[];
  skills: Skill[];
  inputSchema: unknown | null;
  outputSchema: unknown | null;
}

export async function insertAgent(i: InsertAgentInput): Promise<Agent> {
  const rows = await query<Agent>(
    `INSERT INTO agents
       (id, org_id, name, role, description, execution_mode, provider_id, model,
        current_prompt_version, input_schema, output_schema,
        tools, limits, intro, skills)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,
             $12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb)
     RETURNING id, name, role, description, execution_mode, provider_id, model,
               current_prompt_version, tools, limits, intro, skills,
               to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
               to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    [
      i.id,
      i.orgId,
      i.name,
      i.role,
      i.description,
      i.executionMode,
      i.providerId,
      i.model,
      i.currentPromptVersion,
      i.inputSchema ? JSON.stringify(i.inputSchema) : null,
      i.outputSchema ? JSON.stringify(i.outputSchema) : null,
      JSON.stringify(i.tools),
      JSON.stringify(i.limits),
      JSON.stringify(i.intro),
      JSON.stringify(i.skills),
    ],
  );
  return rows[0];
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  description?: string;
  executionMode?: ExecutionMode;
  providerId?: string;
  model?: string;
  tools?: string[];
  limits?: AgentLimits;
  currentPromptVersion?: string;
}

export async function updateAgent(
  orgId: string,
  id: string,
  patch: UpdateAgentInput,
): Promise<Agent | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const add = (col: string, value: unknown, cast = "") => {
    sets.push(`${col} = $${i++}${cast}`);
    params.push(value);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.role !== undefined) add("role", patch.role);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.executionMode !== undefined) add("execution_mode", patch.executionMode);
  if (patch.providerId !== undefined) add("provider_id", patch.providerId);
  if (patch.model !== undefined) add("model", patch.model);
  if (patch.tools !== undefined) add("tools", JSON.stringify(patch.tools), "::jsonb");
  if (patch.limits !== undefined) add("limits", JSON.stringify(patch.limits), "::jsonb");
  if (patch.currentPromptVersion !== undefined)
    add("current_prompt_version", patch.currentPromptVersion);

  if (sets.length === 0) return getAgent(orgId, id);

  params.push(id, orgId);
  const rows = await query<Agent>(
    `UPDATE agents
        SET ${sets.join(", ")}
      WHERE id = $${i++} AND org_id = $${i++} AND archived_at IS NULL
      RETURNING id, name, role, description, execution_mode, provider_id, model,
                current_prompt_version, tools, limits, intro, skills,
                to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS archived_at,
                to_char(created_at,  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function archiveAgent(orgId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE agents SET archived_at = now()
      WHERE id = $1 AND org_id = $2 AND archived_at IS NULL
      RETURNING id`,
    [id, orgId],
  );
  return rows.length > 0;
}

// ─── Prompt versions ─────────────────────────────────────────────────────────

export interface PromptVersion {
  id: string;
  agent_id: string;
  version: string;
  system_prompt: string | null;
  task_prompt: string | null;
  tool_instructions: string | null;
  note: string | null;
  created_at: string;
}

export async function insertPromptVersion(
  id: string,
  agentId: string,
  version: string,
  systemPrompt: string,
  taskPrompt: string,
  toolInstructions: string,
  note: string,
): Promise<PromptVersion> {
  const rows = await query<PromptVersion>(
    `INSERT INTO prompt_versions
       (id, agent_id, version, system_prompt, task_prompt, tool_instructions, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, agent_id, version, system_prompt, task_prompt, tool_instructions, note,
               to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    [id, agentId, version, systemPrompt, taskPrompt, toolInstructions, note],
  );
  return rows[0];
}

export async function listPromptVersions(
  orgId: string,
  agentId: string,
): Promise<PromptVersion[]> {
  return query<PromptVersion>(
    `SELECT p.id, p.agent_id, p.version, p.system_prompt, p.task_prompt,
            p.tool_instructions, p.note,
            to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM prompt_versions p
       JOIN agents a ON a.id = p.agent_id
      WHERE p.agent_id = $1 AND a.org_id = $2
      ORDER BY p.created_at DESC`,
    [agentId, orgId],
  );
}

export async function nextPromptVersion(agentId: string): Promise<string> {
  const rows = await query<{ version: string }>(
    `SELECT version FROM prompt_versions WHERE agent_id = $1`,
    [agentId],
  );
  let max = 0;
  for (const r of rows) {
    const m = /^v(\d+)$/.exec(r.version);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `v${max + 1}`;
}
