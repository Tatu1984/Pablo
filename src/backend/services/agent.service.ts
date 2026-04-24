import { newId } from "@/backend/utils/id.util";
import {
  archiveAgent as archiveAgentRow,
  getAgent,
  insertAgent,
  insertPromptVersion,
  listPromptVersions,
  nextPromptVersion,
  updateAgent as updateAgentRow,
  type InsertAgentInput,
} from "@/backend/repositories/agent.repository";
import { getProvider } from "@/backend/repositories/provider.repository";
import type {
  CreateAgentInput,
  CreatePromptInput,
  UpdateAgentInput,
} from "@/backend/validators/agent.validator";
import type { Agent } from "@/shared/types/agent.types";

export class AgentError extends Error {
  constructor(
    public code:
      | "not_found"
      | "provider_not_found"
      | "model_not_allowed"
      | "archive_failed",
    message: string,
  ) {
    super(message);
  }
}

async function assertProviderAndModel(orgId: string, providerId: string, model: string) {
  const p = await getProvider(orgId, providerId);
  if (!p) throw new AgentError("provider_not_found", "Provider not found.");
  if (!p.models.includes(model)) {
    throw new AgentError(
      "model_not_allowed",
      `Model "${model}" is not enabled on provider "${p.name}".`,
    );
  }
  return p;
}

export async function createAgent(orgId: string, input: CreateAgentInput): Promise<Agent> {
  await assertProviderAndModel(orgId, input.provider_id, input.model);

  const agentId = newId("agent");
  const initialVersion = "v1";

  const payload: InsertAgentInput = {
    id: agentId,
    orgId,
    name: input.name,
    role: input.role,
    description: input.description,
    executionMode: input.execution_mode,
    providerId: input.provider_id,
    model: input.model,
    currentPromptVersion: initialVersion,
    tools: input.tools,
    limits: input.limits,
    intro: [`Hello, I'm ${input.name}.`, "Ask me something or kick off a task."],
    skills: [],
    inputSchema: input.input_schema,
    outputSchema: input.output_schema,
  };

  const agent = await insertAgent(payload);
  await insertPromptVersion(
    newId("prm"),
    agentId,
    initialVersion,
    "",
    "",
    "",
    "Created with agent",
  );
  return agent;
}

export async function updateAgent(
  orgId: string,
  id: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const current = await getAgent(orgId, id);
  if (!current) throw new AgentError("not_found", "Agent not found.");

  const providerId = input.provider_id ?? current.provider_id;
  const model = input.model ?? current.model;
  if (input.provider_id !== undefined || input.model !== undefined) {
    await assertProviderAndModel(orgId, providerId, model);
  }

  const updated = await updateAgentRow(orgId, id, {
    name: input.name,
    role: input.role,
    description: input.description,
    executionMode: input.execution_mode,
    providerId: input.provider_id,
    model: input.model,
    tools: input.tools,
    limits: input.limits,
  });
  if (!updated) throw new AgentError("not_found", "Agent not found.");
  return updated;
}

export async function archiveAgent(orgId: string, id: string): Promise<void> {
  const ok = await archiveAgentRow(orgId, id);
  if (!ok) throw new AgentError("archive_failed", "Agent not found or already archived.");
}

export async function publishPromptVersion(
  orgId: string,
  agentId: string,
  input: CreatePromptInput,
) {
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new AgentError("not_found", "Agent not found.");

  const version = await nextPromptVersion(agentId);
  const pv = await insertPromptVersion(
    newId("prm"),
    agentId,
    version,
    input.system_prompt,
    input.task_prompt,
    input.tool_instructions,
    input.note || `Published ${version}`,
  );
  await updateAgentRow(orgId, agentId, { currentPromptVersion: version });
  return pv;
}

export async function getPromptVersions(orgId: string, agentId: string) {
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new AgentError("not_found", "Agent not found.");
  return listPromptVersions(orgId, agentId);
}
